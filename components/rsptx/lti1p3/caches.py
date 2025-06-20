# Caches used to store the state of an LTI 1.3 launch

import json
import os

import redis

class SimpleCache:
    """
    Simple in memory dict cache - not suitable for production
    """
    def __init__(self):
        self._cache = {}

    def get(self, key):
        return self._cache.get(key)

    def set(self, key, value, expiration=None):
        self._cache[key] = value



class RedisCache:
    """
    Redis based cache
    """

    redis = None

    def __init__(self):
        reddis_addr = os.environ.get("REDIS_URI", "redis://host.docker.internal:6379/0")
        self.redis = redis.from_url(reddis_addr, decode_responses=True)
        if not self.redis.ping():
            raise Exception(f"Failed to connect to Redis at {reddis_addr}")

    def get(self, key):
        val = self.redis.get(key)
        if not val:
            return None
        # now figure out if it is json or a bool
        try:
            return json.loads(val)
        except:
            if val.lower() == "true":
                return True
            elif val.lower() == "false":
                return False
            # must be a string
            return val

    def set(self, key, value, expiration=600):
        # pylti1p3 library tries to store dicts and bools
        # make sure we don't give redis those
        if type(value) == bool:
            value = str(value)
        elif type(value) == dict:
            value = json.dumps(value)
        self.redis.set(key, value, ex=expiration)
