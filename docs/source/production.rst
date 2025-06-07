.. _moving-to-production:

Moving to Production
======================

.. warning::
   This page needs to be written

Running your own server? Let us know
-------------------------------------

If you run your own Runestone server we would love to hear from you. Please make an issue in this repo and just tell us where you are at and how many students you serve. As we seek grant funding, understanding the impact of Runestone is very important. Thanks!


Deploying Runestone to a production environment will be substantially more complex than setting up a development copy, but will make use of many of the same tools. Before undertaking a deployment you should:

1) Make sure that you need your own Runestone installation. If you want to run classes using an existing Runestone book, or to author a new book, it is quite likely you can do so on the Runestone Academy infrastructure.

2) Have previously successfully set up and used a development environment. This will enable you to understand the production environment setup as changes to the simpler development setup.

Dealing with HTTPS and secure cookies
-------------------------------------

One of the first challenges in running your own server is dealing with the fact that Runestone uses secure cookies for authentication and user session tracking. When developing, you often are in a situation where you don't have access to a domain name and a certificate to go with it.

One option available, for development purposes only, is to use the ``ALLOW_INSECURE_LOGIN`` environment variable described in :ref:`environment-variables`, then access your site via HTTP only.

To enable HTTPS you need two things: A domain name on which you can attach a certificate, and a certificate attached to that domain. Below is a description of one easy way to obtain these two pieces, using `Caddy <https://caddyserver.com/>`_ and `nip.io <https://nip.io/>`_.

Nip.io is a simple service that forwards from something like ``34.57.123.10.nip.io`` to ``34.57.123.10``. This effectively allows you to associate a domain name (34.57.123.10.nip.io) to an IP address. If you only have an IP address but not a domain name yet, you can use this service instead to get started.

With a domain at hand, a simple way to get HTTPS up and running is to use a container running Caddy as a reverse proxy in front of the nginx container currently used by Runestone. Before discussing how to do this, note that there are two other possible avenues available, for those who wish to pursue them. One is to set up HTTPS within the nginx container itself, using `certbot <certbot.eff.org>`_. Some instructions can be found on `this Medium post <https://medium.com/rahasak/setup-lets-encrypt-certificate-with-nginx-certbot-and-docker-b13010a12994>`_. The other is to replace nginx entirely with Caddy. This would require the considerable effort of rewriting the Runestone nginx configuration files in Caddyfile form. You can find those files in ``projects/nginx``.

To create a container running Caddy you first need to create a `Caddyfile`. You can place this wherever you like, as long as you adjust the link to it. This assumes it is placed at the top level of the Runestone project (the ``rs`` directory). Its contents should be:

.. code-block::

   34.57.123.10.nip.io {
      reverse_proxy nginx:80
   }

The only thing different in your setup would be the domain name on the first line. Next we need to add to the ``docker-compose.yml`` file a new container (if you prefer to create the container directly you should be able to easily adjust this, just make sure you add it to the network created by docker-compose, which contains all the other services).

.. code-block::

   web:
    image: caddy
    restart: always
    ports:
      - 80:80
      - 443:443
    volumes:
      - ${PWD}/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    extra_hosts:
      - host.docker.internal:host-gateway
    depends_on:
      - nginx

For this to work you must also add a volume called `caddy_data` to the docker-compose. Lastly, change the ``nginx`` service's configuration in the docker-compose file to having link ports ``8000:80`` instead of ``80:80`` (you can probably use any other number or even comment it out entirely).

Now simply start the ``web`` service, and restart nginx if needed, and you should be good to go! Caddy will take care to acquire the needed certificates. Make sure that you server is open on port 443. You just need to remember to use the ``....nip.io`` address to your site rather than the raw ip address.
