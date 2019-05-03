#!/bin/bash
docker run --name mysql-abstraction-mariadb -e MYSQL_ROOT_PASSWORD=root -d -p 127.0.0.1:3307:3306 mariadb:10.1
sleep 15
tsc
mocha --exit --reporter spec --ui tdd tests/*.js --timeout 5000
docker kill mysql-abstraction-mariadb
docker rm mysql-abstraction-mariadb
