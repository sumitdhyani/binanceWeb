How to start:
1. If directory has been cloned for the 1st time, run the following commad:
docker-compose up node_package_installer;docker-compose up -d kafka_3
else run the following command:
docker-compose up -d kafka_3 

2. Check if all the topics have been created and available by running the command:
./bin/kafka-topics.sh --zookeeper 127.0.0.1:2181 --list

3. When you see all the topics, run the following command:
docker-compose up -d

