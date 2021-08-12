#!/bin/bash
set -eu
docker network create mysql-abstraction || true
docker run --net mysql-abstraction --name mysql-abstraction-db -e MYSQL_ROOT_PASSWORD=root -d mysql:5.7
sleep 30
docker run \
    -e MYSQL_USER=root \
    -e MYSQL_PASSWORD=root \
    -e MYSQL_HOST=mysql-abstraction-db \
    --net mysql-abstraction \
    --rm -ti \
    -v "$PWD:$PWD" \
    -w "$PWD" \
    node:latest npm test
docker kill mysql-abstraction-db
docker rm mysql-abstraction-db
