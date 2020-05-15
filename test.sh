#!/bin/bash
docker run --name mysql-abstraction-db -e MYSQL_ROOT_PASSWORD=root -d -p 127.0.0.1:3307:3306 mysql:5.7
sleep 30
export MYSQL_USER=root
export MYSQL_PASSWORD=root
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3307
npm test
docker kill mysql-abstraction-db
docker rm mysql-abstraction-db
