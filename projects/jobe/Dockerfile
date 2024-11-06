# Jobe-in-a-box: a Dockerised Jobe server (see https://github.com/trampgeek/jobe)
# With thanks to David Bowes (d.h.bowes@lancaster.ac.uk) who did all the hard work
# on this originally.

FROM docker.io/ubuntu:24.04

# https://github.com/opencontainers/image-spec/blob/master/annotations.md
LABEL \
    org.opencontainers.image.authors="richard.lobb@canterbury.ac.nz,j.hoedjes@hva.nl,d.h.bowes@herts.ac.uk" \
    org.opencontainers.image.title="JobeInABox" \
    org.opencontainers.image.description="JobeInABox" \
    org.opencontainers.image.documentation="https://github.com/trampgeek/jobeinabox" \
    org.opencontainers.image.source="https://github.com/trampgeek/jobeinabox"

ARG TZ=Pacific/Auckland
# Set up the (apache) environment variables
ENV APACHE_RUN_USER=www-data
ENV APACHE_RUN_GROUP=www-data
ENV APACHE_LOG_DIR=/var/log/apache2
ENV APACHE_LOCK_DIR=/var/lock/apache2
ENV APACHE_PID_FILE=/var/run/apache2.pid
ENV LANG=C.UTF-8

# Copy apache virtual host file for later use
COPY 000-jobe.conf /
# Copy test script
COPY container-test.sh /

# Mount secrets
# Set timezone
# Install extra packages
# Redirect apache logs to stdout
# Configure apache
# Configure php
# Get jobe
# Handle jobe API keys
# Install jobe
# Clean up
RUN --mount=type=secret,id=api_keys \
    export API_KEYS=`cat /run/secrets/api_keys | tr '\n' ' '` && \
    ln -snf /usr/share/zoneinfo/"$TZ" /etc/localtime && \
    echo "$TZ" > /etc/timezone && \
    apt-get update && \
    apt-get --no-install-recommends install -yq \
        acl \
        apache2 \
        build-essential \
        fp-compiler \
        git \
        libapache2-mod-php \
        nano \
        nodejs \
        octave \
        default-jdk \
        php \
        php-cli \
        php-mbstring \
        php-intl \
        python3 \
        python3-pip \
        python3-setuptools \
        pylint \
        sqlite3 \
        sudo \
        tzdata \
        unzip && \
    pylint --reports=no --score=n --generate-rcfile > /etc/pylintrc && \
    ln -sf /proc/self/fd/1 /var/log/apache2/access.log && \
    ln -sf /proc/self/fd/1 /var/log/apache2/error.log && \
    sed -i "s/export LANG=C/export LANG=$LANG/" /etc/apache2/envvars && \
    sed -i '1 i ServerName localhost' /etc/apache2/apache2.conf && \
    sed -i 's/ServerTokens\ OS/ServerTokens \Prod/g' /etc/apache2/conf-enabled/security.conf && \
    sed -i 's/ServerSignature\ On/ServerSignature \Off/g' /etc/apache2/conf-enabled/security.conf && \
    rm /etc/apache2/sites-enabled/000-default.conf && \
    mv /000-jobe.conf /etc/apache2/sites-enabled/ && \
    mkdir -p /var/crash && \
    chmod 777 /var/crash && \
    echo '<!DOCTYPE html><html lang="en"><title>Jobe</title><h1>Jobe</h1></html>' > /var/www/html/index.html
# Get Jobe from RS repository instead of the original one
RUN git https://github.com/RunestoneInteractive/jobe.git /var/www/html/jobe && \
    apache2ctl start && \
    cd /var/www/html/jobe && \
    if [ ! -z "${API_KEYS}" ]; then \
        sed -i 's/$require_api_keys = false/$require_api_keys = true/' /var/www/html/jobe/app/Config/Jobe.php && \
        sed -i "s/'2AAA7A.*/$API_KEYS/" /var/www/html/jobe/app/Config/Jobe.php \
    ; fi && \
    /usr/bin/python3 /var/www/html/jobe/install --max_uid=500 && \
    chown -R ${APACHE_RUN_USER}:${APACHE_RUN_GROUP} /var/www/html && \
    apt-get -y autoremove --purge && \
    apt-get -y clean && \
    rm -rf /var/lib/apt/lists/*

# Fix catch.hpp (use the one from catch2)
RUN rm -f /usr/include/catch.hpp && ln -s /usr/include/catch2/catch.hpp /usr/include/catch.hpp

# Get doctest.h - could instead point to stable version like
#   https://github.com/doctest/doctest/releases/download/v2.4.11/doctest.h
RUN apt-get update && apt-get install -yq wget && \
    wget https://github.com/doctest/doctest/releases/latest/download/doctest.h -O /usr/include/doctest.h

# Expose apache
EXPOSE 80

# Healthcheck every minute, minimaltest.py should complete within 2 seconds
# If you're running docker version 25.0 or later, you could consider
# changing the following line to
# HEALTHCHECK --start-period=30s --start-interval=5s --interval=5m --timeout=2s \
HEALTHCHECK --interval=1m --timeout=2s \
    CMD /usr/bin/python3 /var/www/html/jobe/minimaltest.py || exit 1

# Start apache
CMD ["/usr/sbin/apache2ctl", "-D", "FOREGROUND"]
