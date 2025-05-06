#!/bin/bash

# Get the disk usage percentage of Docker
DOCKER_DISK_USAGE=$(df /var/lib/docker | awk 'NR==2 {print $5}' | sed 's/%//')

# Check if the disk usage is above 90%
if [ "$DOCKER_DISK_USAGE" -gt 90 ]; then
    echo "Docker disk usage is above 90%. Cleaning up unused images and containers..."
    # Remove unused Docker images
    docker images --format '{{.Repository}}:{{.Tag}}' | grep -v 'important' |grep -v 'latest' | xargs -r docker rmi
    # Remove unused Docker containers
    docker container prune -f
else
    echo "Docker disk usage is below 90%. No cleanup needed."
fi
