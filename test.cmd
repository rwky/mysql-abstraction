CALL docker run --name mysql-abstraction-mariadb -e MYSQL_ROOT_PASSWORD=root -d -p 127.0.0.1:3307:3306 mariadb:10.1
CALL timeout 15
CALL tsc
CALL mocha --exit --reporter spec --ui tdd tests/*.js --timeout 5000
CALL docker kill mysql-abstraction-mariadb
CALL docker rm mysql-abstraction-mariadb