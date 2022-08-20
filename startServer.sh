docker rm setup_mkt_gateway_1
docker rm setup_kafka_1
docker rm setup_zookeeper_1
rm -fr docker.sock
rm -fr kafka
docker build . -t python_base
docker-compose up -d
