FROM ubuntu:20.04
RUN apt-get -y update && apt-get -y upgrade
RUN apt-get install -y software-properties-common
RUN apt-get install -y openjdk-8-jdk
RUN apt-get install -y openjdk-8-jre
RUN apt-get install -y wget
RUN apt-get install -y vim 
RUN apt-get install -y cmake gcc g++
RUN apt-get install -y build-essential 
RUN apt-get install -y git 
RUN apt-get install -y gdb
RUN apt-get install -y python
RUN apt-get install -y python3-pip
RUN pip install python-binance
RUN pip install --upgrade poloniexapi
RUN pip install aiokafka
RUN pip install pudb
RUN wd="$(pwd)" && echo $wd
RUN file="$(ls -1rth)" && echo $file
RUN apt-get install -y curl 
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
RUN apt-get install -y nodejs
