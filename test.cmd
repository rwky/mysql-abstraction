CALL docker run --name mysql-abstraction-mariadb -e MYSQL_ROOT_PASSWORD=root -d -p 127.0.0.1:3307:3306 mariadb:10.1
CALL timeout 15
CALL npm run build
CALL npm run coverage
CALL docker kill mysql-abstraction-mariadb
CALL docker rm mysql-abstraction-mariadb
