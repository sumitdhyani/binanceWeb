#pragma once
#include <unordered_map>
//Acts a light weight pub-sub mechanism
//Making it templatized make is to be able to be used as a type safe mechanism
template<class Key, class Data>
struct DataRouter
{
	typedef std::function<void(Data)> DataCallback;

	//Produce Data with the specified key
	bool produce(Key key, Data data)
	{
		bool retVal = false;
		if (auto it = m_routingTable.find(key); it != m_routingTable.end())
			for (const auto& [registrationId, callback] : it->second)
			{
				callback(data);
				retVal = true;
			}

		return retVal;
	}


	bool consume(Key key, size_t registrationId, DataCallback callback)
	{
		bool retVal = true;
		if (auto it = m_routingTable.find(key); it != m_routingTable.end())
			if (auto itCallback = it->second.find(registrationId); itCallback == it->second.end())
				it->second[registrationId] = callback;
			else
				retVal = false;
		else
			m_routingTable[key] = { {registrationId, callback} };

		return retVal;
	}

	bool unregister(Key key, size_t registrationId)
	{
		bool retVal = false;
		if (auto it = m_routingTable.find(key); it != m_routingTable.end())
			if (auto itCallback = it->second.find(registrationId); itCallback != it->second.end())
			{
				it->second.erase(itCallback);
				retVal = true;
			}

		return retVal;
	}

	void unregisterAll(size_t registrationId)
	{
		for (const auto& [key, callbacks] : m_routingTable)
			unregister(key, registrationId);
	}

private:
	std::unordered_map<Key, std::unordered_map<size_t, DataCallback>> m_routingTable;
};

typedef DataRouter<std::string, PatsPriceLogonMsg_SPtr> LogonRequestRouter;
DEFINE_SPTR(LogonRequestRouter)

typedef DataRouter<std::string, PatsPriceLogonReplyMsg_SPtr> LogonReplyRouter;
DEFINE_SPTR(LogonReplyRouter)

typedef DataRouter<std::string, PriceMessage_SPtr> PriceRouter;
DEFINE_SPTR(PriceRouter)

typedef DataRouter<std::string, PriceSettlementMsg_SPtr> SettlementRouter;
DEFINE_SPTR(SettlementRouter)

typedef DataRouter<std::string, PatsSubscriptionMsg_SPtr> SubRouter;
DEFINE_SPTR(SubRouter)

typedef DataRouter<std::string, PatsSubscriptionMsg_SPtr> UnsubRouter;
DEFINE_SPTR(UnsubRouter)

typedef DataRouter<std::string, PatsTSPriceMsg_SPtr> TSPriceRouter;
DEFINE_SPTR(TSPriceRouter)

typedef DataRouter<std::string, BroadcastMsg_SPtr> BroadCastMessageRouter;
DEFINE_SPTR(BroadCastMessageRouter)

typedef DataRouter<std::string, OperationalStatusMsg_SPtr> OpStatusRouter;
DEFINE_SPTR(OpStatusRouter)


template<class Key, class SubData, class UnsubData>
struct SubUnsubHandler
{
	typedef std::function<void(SubData)> SubAction;
	typedef std::function<void(UnsubData)> UnsubAction;

	SubUnsubHandler(SubAction subAction, UnsubAction unsubAction) : m_subAction(subAction), m_unsubAction(unsubAction) {}

	void subscribe(Key key, SubData data)
	{
		if (auto it = m_subscriptionBook.find(key); it != m_subscriptionBook.end())
			++it->second;
		else
		{
			m_subscriptionBook[key] = 1;
			m_subAction(data);
		}
	}

	bool unsubscribe(Key key, UnsubData data)
	{
		if (auto it = m_subscriptionBook.find(key); it != m_subscriptionBook.end())
		{
			if (--it->second)
			{
				m_unsubAction(data);
				m_subscriptionBook.erase(it);
			}
			return true;
		}

		return false;
	}
private:
	SubAction m_subAction;
	UnsubAction m_unsubAction;
	std::unordered_map<Key, int> m_subscriptionBook;
};

typedef SubUnsubHandler<std::string, PatsSubscriptionMsg_SPtr, PatsSubscriptionMsg_SPtr> PatsSubscriptionHandler;

