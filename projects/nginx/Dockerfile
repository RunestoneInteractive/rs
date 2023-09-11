FROM nginx

# The context for this Dockerfile is the root of the runestone repo
LABEL org.opencontainers.image.source https://github.com/RunestoneInteractive/rs

COPY projects/nginx/runestone /etc/nginx/conf.d/default.conf

# Copy the shared staticAssets so they can be served by nginx
COPY components/rsptx/templates/staticAssets /usr/share/nginx/html/staticAssets

# This image is meant to be used as the main tenant on a virtual machine.   It does not play well
# with other tenants on the same machine. 

# See - https://medium.com/rahasak/setup-lets-encrypt-certificate-with-nginx-certbot-and-docker-b13010a12994 to set up certbot
