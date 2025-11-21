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

ARG TZ=Etc/GMT-0
# Set up the (apache) environment variables
ENV APACHE_RUN_USER www-data
ENV APACHE_RUN_GROUP www-data
ENV APACHE_LOG_DIR /var/log/apache2
ENV APACHE_LOCK_DIR /var/lock/apache2
ENV APACHE_PID_FILE /var/run/apache2.pid
ENV LANG C.UTF-8

# Copy apache virtual host file for later use
COPY 000-jobe.conf /
# Copy test script
COPY container-test.sh /
COPY include/* /usr/include/
RUN mkdir -p /usr/local/lib/java
COPY files/* /usr/local/lib/java/
RUN chmod a+w /usr/local/lib/java


# Set timezone
# Install extra packages
# Redirect apache logs to stdout
# Configure apache
# Configure php
# Get and install jobe - from RunestoneInteractive/jobe - contains our changes.
# Clean up
RUN ln -snf /usr/share/zoneinfo/"$TZ" /etc/localtime && \
    echo "$TZ" > /etc/timezone && \
    apt-get update && \
    apt-get --no-install-recommends install -yq \
    acl \
    apache2 \
    build-essential \
    fp-compiler \
    g++-14 \
    gcc-14 \
    git \
    libapache2-mod-php \
    nodejs \
    octave \
    openjdk-21-jdk \
    php \
    php-cli \
    php-mbstring \
    python3 \
    python3-pip \
    python3-setuptools \
    sqlite3 \
    sudo \
    tzdata \
    unzip \
    vim \
    wget

RUN python3 -m pip install --break-system-packages pylint beautifulsoup4 pandas requests altair && \
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
    echo '<!DOCTYPE html><html lang="en"><title>Jobe</title><h1>Jobe</h1></html>' > /var/www/html/index.html && \
    git clone https://github.com/RunestoneInteractive/jobe.git /var/www/html/jobe && \
    apache2ctl start && \
    cd /var/www/html/jobe && \
    /usr/bin/python3 /var/www/html/jobe/install && \
    chown -R ${APACHE_RUN_USER}:${APACHE_RUN_GROUP} /var/www/html && \
    apt-get -y autoremove --purge && \
    apt-get -y clean && \
    rm -rf /var/lib/apt/lists/*

# Prefer gcc-14 and g++-14
RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-14 60 && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-14 60

# Fix catch.hpp (use the one from catch2).
RUN rm -f /usr/include/catch.hpp
# Note: we can't use a tag like "latest" because we actually require
# catch version 2 (the catch2 in ubuntu is actually catch3!)
RUN wget https://github.com/catchorg/Catch2/releases/download/v2.13.10/catch.hpp -O /usr/include/catch.hpp

# Get doctest.h - could instead point to stable version like
#   https://github.com/doctest/doctest/releases/download/v2.4.11/doctest.h
RUN wget https://github.com/doctest/doctest/releases/latest/download/doctest.h -O /usr/include/doctest.h

# Install Kotlin
ENV KOTLIN_VERSION=2.2.21
RUN wget https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip -O /opt/kotlin.zip \
    && unzip /opt/kotlin.zip -d /opt \
    && rm /opt/kotlin.zip

RUN chmod -R a+rw /opt/kotlinc

# Expose apache
EXPOSE 80

# Healthcheck, minimaltest.py should complete within 2 seconds
HEALTHCHECK --interval=5m --timeout=2s \
    CMD /usr/bin/python3 /var/www/html/jobe/minimaltest.py || exit 1

# Start apache
CMD ["/usr/sbin/apache2ctl", "-D", "FOREGROUND"]
