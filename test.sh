#!/bin/bash
docker run --name mysql-abstraction-mariadb -e MYSQL_ROOT_PASSWORD=root -d -p 127.0.0.1:3307:3306 mariadb:10.1
sleep 15
npm run build
npm run coverage 
docker kill mysql-abstraction-mariadb
docker rm mysql-abstraction-mariadb
