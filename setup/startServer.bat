docker rm setup_mkt_gateway_1
docker rm setup_kafka_1
docker rm setup_zookeeper_1
docker rmi market_gateway
del /F /Q docker.sock
del /F /Q kafka
docker build . -t market_gateway
docker-compose up