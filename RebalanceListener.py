import aiokafka
from aiokafka.abc import ConsumerRebalanceListener



class RebalanceListener(ConsumerRebalanceListener):
    def __init__(self, logger, synchronizedTopics, rebalanceCallback):
        self.consumptionBook = {}
        self.logger = logger
        self.synchronizedTopics = synchronizedTopics
        self.rebalanceCallback = rebalanceCallback

    async def onRebalance(self, topicPartitions):
        #create a dictionary, with the structure, key->topic, value->set of assigned partitions fo that topic
        reassignmentBook = {}
        for topicPartition in topicPartitions:
            if topicPartition.topic not in self.synchronizedTopics:
                continue
            if topicPartition.topic not in reassignmentBook.keys():
                reassignmentBook[topicPartition.topic] = set()
            reassignmentBook[topicPartition.topic].add(topicPartition.partition)
        
        newAssigned = []
        revoked = []
        for topic in reassignmentBook.keys():
            if topic not in self.consumptionBook.keys():
                newAssigned.extend([(topic,partition) for partition in reassignmentBook[topic]])
            else:
                currentPartitions = self.consumptionBook[topic]
                newPartitions = reassignmentBook[topic]
                for partition in newPartitions:
                    if partition not in currentPartitions:
                        newAssigned.append((topic, partition))
                for partition in currentPartitions:
                    if partition not in newPartitions:
                        revoked.append((topic, partition))

        self.consumptionBook = reassignmentBook
        await self.rebalanceCallback(revoked, newAssigned)

    async def on_partitions_assigned(self, topicPartitions):
        await self.onRebalance(topicPartitions)
        
    async def on_partitions_revoked(self, topicPartitions):
        pass
        