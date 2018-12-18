#!/bin/bash
docker run --name mysql-abstraction-mariadb -e MYSQL_ROOT_PASSWORD=root -d -p 127.0.0.1:3307:3306 mariadb:10.1
sleep 15
export MYSQL_USER=root
export MYSQL_PASSWORD=root
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3307
make
make lint
make $1
docker kill mysql-abstraction-mariadb
docker rm mysql-abstraction-mariadb
