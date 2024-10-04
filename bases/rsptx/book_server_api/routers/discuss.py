# ******************************************************
# |docname| - Provide a scalable synchronous chat system
# ******************************************************
# For effective peer instructio in a mixed or online class we must support some
# kind of chat system.  This may spill over into other use cases but for now the
# peer instruction pages are the main use case.  To provide a near real time chat
# environment we need to use websockets.  This is a new area for us in summer 2021
# creating a websocket chat system is super simple for a toy environment. One server
# process can track all users and their connections, but in a production environment
# with multiple workers it gets much more complicated.  `this article <https://tsh.io/blog/how-to-scale-websocket/>`_
# does a nice job of explaining the issues and solutions.
#
# Our architecture is as follows:
# We will use redis pubsub model to support a fast production environment.
#
# We have one end point called ``websocket_endpoint`` that browsers open a websocket with
# this connection is only for the page to RECEIVE messages.  The endpoint is also a redis
# subscriber to the "peermessages" channel.
#
# We have a second endpoint called ``send_message`` that accepts a json formatted message
# package.  This could be a broadcast text message, or could be a special control mesage
# that allows the instructor to move the students through the peer process.  The ``send_message``
# endpoint is the redis producer.
#
# The producer sends the message into the redis queue and then all copies of the consumer
# look at the message.  If the recipient of that message is connected to that instance
# then the message is sent to the recipient and all other instance ignore that message.
# If the message is a broadcast message then all instances of the consumer forward that
# message to all connected parties.

import json
import os
import time

#
# Third-party imports
# -------------------
from typing import Dict, Optional, Any
from multi_await import multi_await  # type: ignore

from redis import asyncio as aioredis

# Local application imports
# -------------------------
from fastapi import (
    APIRouter,
    Cookie,
    Query,
    WebSocket,  # Depends,; noqa F401
    status,
)
from fastapi.templating import Jinja2Templates

from rsptx.logging import rslogger
from rsptx.configuration import settings
from rsptx.db.crud import create_useinfo_entry
from rsptx.db.models import UseinfoValidation
from rsptx.validation.schemas import PeerMessage
from ..localconfig import local_settings
from rsptx.response_helpers.core import canonical_utcnow

# from ..session import auth_manager

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
# Remove the "discuss" prefix until PR #2640 of FastAPI is merged
router = APIRouter(
    tags=["discuss"],
)

templates = Jinja2Templates(
    directory=f"{local_settings._book_server_path}/templates/discuss"
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user: str, websocket: WebSocket):
        await websocket.accept()
        rslogger.info(f"PEERCOM {os.getpid()}: {user} connected to websocket")
        self.active_connections[user] = websocket

    def disconnect(self, sockid: str):
        del self.active_connections[sockid]

    async def send_personal_message(
        self,
        receiver: str,
        message: Dict[str, Any],
    ):
        to = receiver
        if to in self.active_connections:
            try:
                rslogger.info(
                    f"PEERCOM {os.getpid()}: sending {message} to {to} on {self.active_connections[to]}"
                )
                await self.active_connections[to].send_json(message)
            except Exception as e:
                rslogger.error(f"PEERCOM {os.getpid()}: Error sending to {to} is {e}")
                del self.active_connections[to]
        else:
            rslogger.error(
                f"PEERCOM {os.getpid()}: {to} is not connected here {self.active_connections}"
            )

    async def broadcast(self, message: str) -> None:
        rslogger.info(
            f"PEERCOM Broadcast: {os.getpid()}: {self.active_connections=} {message=}"
        )
        to_remove = []
        for key, connection in self.active_connections.items():
            rslogger.info(f"PEERCOM {os.getpid()}: sending to {key}@{connection}")
            try:
                await connection.send_json(message)
            except Exception as e:
                rslogger.info(f"PEERCOM {os.getpid()}: Failed to send {e}")
                to_remove.append(key)
        for key in to_remove:
            del self.active_connections[key]


# this is good for prototyping, but we will need to integrate with
# Redis or a DB for production where we have multiple servers
manager = ConnectionManager()
local_users = set()


async def get_cookie_or_token(
    websocket: WebSocket,
    access_token: Optional[str] = Cookie(None),
    user: Optional[str] = Query(None),
):
    rslogger.info(f"PEERCOM {os.getpid()}: HELLO {access_token=} or {user=}")
    if access_token is None and user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    return access_token or user


# It seems that ``@router.websocket`` is much better than the documented
# ``websocket_route``
@router.websocket("/chat/{uname}/ws")
async def websocket_endpoint(websocket: WebSocket, uname: str):
    """
    This endpoint is called to establish a websocket connection between
    The browser and the server.  The websocket is persistent as long
    as the process that runs this endpoint is alive.

    Note: This function must return which means it must be throroughly async
    Using a non async library like plain redis-py will not work as the subscriber
    will block
    """
    rslogger.info(f"PEERCOM {os.getpid()}: IN WEBSOCKET {uname=}")
    username = uname
    # local_users is a global/module variable shared by all  requests served
    # by the same worker process.
    local_users.add(username)
    await manager.connect(username, websocket)
    rslogger.info(
        f"PEERCOM Connecting {username} peer instruction redis to {settings.redis_uri}"
    )
    r = aioredis.from_url(settings.redis_uri)
    subscriber = r.pubsub()

    async def my_get_message():
        return await subscriber.get_message(timeout=1.0, ignore_subscribe_messages=True)

    await subscriber.subscribe("peermessages")

    # multi_await `Docs and links here <http://www.hydrogen18.com/blog/python-await-multiple.html>`_ acts like
    # the generic sockets select statement, returning a result from get as soon
    # as ANY of our async functions have a result available.
    async with multi_await() as mawait:
        mawait.add(my_get_message)
        mawait.add(websocket.receive_text)

        while True:
            # Wait for something to happen
            # get returns two lists one of completions and one of failures
            complete, failures = await mawait.get()
            # i == 0 --> pubsub message
            # i == 1 --> websocket message
            pmess, wsres = complete
            psfail, wsfail = failures

            if wsfail is not None:
                rslogger.error(f"PEERCOMM websocket fail {wsfail}")
                # The fail is more than likely a runtime error from a page close or refresh
                # RuntimeError('Cannot call "receive" once a disconnect message has been received.')
                manager.disconnect(username)
                return

            if psfail is not None:
                rslogger.error(f"PEERCOM pubsub fail {psfail}")
                # probably do not want to return

            # handle message from the pubsub queue
            if pmess is not None:
                rslogger.info(f"PEERCOM handle pubsub mess {os.getpid()}: {pmess=}")
                if pmess["type"] == "message":
                    # This is a message sent into the channel, our stuff is in
                    # the ``data`` field of the redis message
                    data = json.loads(pmess["data"])
                else:
                    rslogger.error(
                        f"PEERCOM {os.getpid()}: unknown message type {pmess['type']}"
                    )
                    continue
                if data["broadcast"]:
                    await manager.broadcast(data)
                else:
                    # because **every** connection runs this same loop
                    # we only want to send a non-broadcast message if
                    # it is to **ourself**. So the to in the message should be username
                    # check to see
                    mess_from = data["from"]
                    partner_list = await r.hget(
                        f"partnerdb_{data['course_name']}", mess_from
                    )
                    if partner_list:
                        partner_list = json.loads(partner_list)
                    else:
                        try:
                            mess = {
                                "type": "text",
                                "from": mess_from,
                                "message": "Could not find a partner for you",
                                "time": time.time(),
                                "broadcast": False,
                                "course_name": data["course_name"],
                                "div_id": data["div_id"],
                            }
                            await manager.send_personal_message(mess_from, mess)
                        except KeyError:
                            rslogger.error(
                                f"PEERCOM Not enough data to construct a message: {data}"
                            )

                        rslogger.error(
                            f"PEERCOM {os.getpid()}: Failed to find a partner for {mess_from}"
                        )
                    if (
                        data["message"] == "enableChat"
                        and data.get("to", None) == username
                    ):
                        await manager.send_personal_message(username, data)
                    elif (
                        data["message"] != "enableChat"
                        and partner_list
                        and username in partner_list
                    ):
                        await manager.send_personal_message(username, data)
                        # log the message
                        # todo - we should not log messages that are 'control' messages
                        # These individual control messages update partner and answer
                        if data["type"] != "control":
                            await create_useinfo_entry(
                                UseinfoValidation(
                                    event="sendmessage",
                                    act=f"to:{username}:{data['message']}",
                                    div_id=data["div_id"],
                                    course_id=data["course_name"],
                                    sid=mess_from,
                                    timestamp=canonical_utcnow(),
                                )
                            )
                    else:
                        if not partner_list:
                            rslogger.info(
                                f"PEERCOM {os.getpid()}: {mess_from=} has no partner list"
                            )
                        else:
                            rslogger.info(
                                f"PEERCOM {os.getpid()}: {mess_from=} is not {username}"
                            )

            if wsres is not None:
                rslogger.info(
                    f"PEERCOM {os.getpid()}: We don't expect in coming websock messages but got: {wsres}"
                )
                # TODO: now that we have multi-await working it *may* be more
                # efficient to go back to sending all peer messages by websocket
                # and putting them into the subscriber queue here rather than
                # having a separate endpoint.


@router.post("/send_message")
async def send_message(packet: PeerMessage):
    r = await aioredis.from_url(settings.redis_uri)
    r.publish("peermessages", packet.json())
