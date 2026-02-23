# BinanceWeb Microservices Architecture Documentation

## Overview
This document describes the architecture of the BinanceWeb cryptocurrency price server backend. The system is designed as a set of microservices orchestrated with Docker Compose, using Kafka as the middleware for inter-service communication. The architecture is extensible to support additional exchanges in the future.

---

## Microservices and Their Roles

### 1. request_router
- **Role:** Routes subscription requests to the appropriate exchange-specific topic.
- **Key File:** marketConnectivity/RequestRouter.py
- **Kafka Topics:** Consumes `price_subscriptions`, produces to exchange-specific topics (e.g., `binance_price_subscriptions`).
- **Extensibility:** Adding a new exchange requires updating the exchange-to-topic mapping.

### 2. binance_mkt_gateway
- **Role:** Fetches real-time price/depth data from Binance and publishes it to Kafka.
- **Key File:** marketConnectivity/binance/PriceFetcher.py
- **Kafka Topics:** Consumes `binance_price_subscriptions`, produces to `prices`.
- **Extensibility:** Designed to allow additional gateways for other exchanges.

### 3. data_dispatcher
- **Role:** Forwards price and virtual price data to the appropriate destination topics for consumers.
- **Key File:** DataDispatcher/DataDispatcher.py
- **Kafka Topics:** Consumes `prices`, `virtual_prices`; produces to destination topics specified in messages.

### 4. web_server
- **Role:** Serves as the backend for the web client, handling subscriptions and relaying price data via websockets.
- **Key File:** httpWebServer/main.js
- **Kafka Topics:** Consumes from topics as needed for client subscriptions.

### 5. web_authenticator
- **Role:** Handles authentication for web clients.
- **Key File:** httpWebServer/WebAuthenticator.js

### 6. virtual_price_fetcher
- **Role:** Computes and publishes synthetic/virtual trading pairs.
- **Key File:** VirtualPriceFetcher/VirtualPriceFetcher.py
- **Kafka Topics:** Consumes `price_subscriptions`, produces to `virtual_prices`.

### 7. topic_data_dumper
- **Role:** Utility for dumping topic data for debugging or analytics.
- **Key File:** testFiles/DataDumper.py

### 8. sync_data_provider
- **Role:** Manages and synchronizes subscription state across services.
- **Key File:** SyncDataProvider/SyncDataProvider.py
- **Kafka Topics:** `pubSub_sync_data`, `pubSub_sync_data_requests`.

### 9. admin_data_provider
- **Role:** Handles admin events, heartbeats, and service registration.
- **Key File:** AdminDataProvider/AdminDataProvider.py
- **Kafka Topics:** `admin_events`, `heartbeats`, `registrations`, `admin_queries`.

---

## Kafka Topics and Message Flows

- **price_subscriptions:** Entry point for all price subscription requests.
- **binance_price_subscriptions:** Binance-specific subscription requests.
- **prices:** Main topic for real-time price/depth data.
- **virtual_prices:** Topic for synthetic/virtual price data.
- **pubSub_sync_data, pubSub_sync_data_requests:** For synchronizing subscription state.
- **admin_events, heartbeats, registrations, admin_queries:** For admin and service health.

Each service produces and/or consumes specific topics as described above. The system is designed so that adding a new exchange involves adding a new gateway service and updating the router and topic mappings.

---

## Inter-Service Communication

- **All communication is asynchronous and event-driven via Kafka topics.**
- **RequestRouter** receives subscription requests and routes them to the correct exchange topic.
- **Market Gateway** (e.g., binance_mkt_gateway) fetches data from the exchange and publishes to the `prices` topic.
- **DataDispatcher** forwards price data to the appropriate consumer topics.
- **Web Server** subscribes to relevant topics and pushes data to the web client via websockets.
- **Admin and Sync Services** manage service health, registration, and subscription state.

---

## Data Flow: Exchange to Client

1. **Client** sends a subscription request (via web_server) →
2. **web_server** emits a Kafka message to `price_subscriptions` →
3. **request_router** receives the request, determines the exchange, and forwards to the appropriate topic (e.g., `binance_price_subscriptions`) →
4. **binance_mkt_gateway** subscribes to the exchange topic, fetches data from Binance, and publishes price updates to `prices` →
5. **data_dispatcher** reads from `prices` and forwards to the destination topic for the web_server →
6. **web_server** receives the data and pushes it to the web client via websocket.

---

## Extensibility for New Exchanges
- To add a new exchange:
  1. Implement a new market gateway service similar to `binance_mkt_gateway`.
  2. Update `request_router` to recognize and route to the new exchange's subscription topic.
  3. Add the new service to `docker-compose.yml` and ensure it uses the correct Kafka topics.

---

## Frontend Architecture: exchange_web_GUI

- **Framework:** Next.js (React-based, with Tailwind CSS and MUI for UI)
- **Directory Structure:**
  - `app/root/`: Core business logic for network interaction and subscription management. Stable, rarely changes.
  - `app/components/`: UI components (tables, dialogs, navigation, etc.).
  - `app/vanilla/`, `app/cross/`, `app/buckets/`: Pages for different subscription types (vanilla, cross, basket).
  - `app/stores/`: Zustand store for global state management (subscriptions, exchanges, errors, etc.).
  - `app/layout.js`: Main layout, includes navigation and error dialogs.
  - `app/page.js`: Landing page.
- **Core Logic:**
  - GUI interacts with backend via business APIs defined in `app/root/`.
  - Subscription logic (subscribe/unsubscribe, virtual pairs, etc.) is abstracted in `Gui-Library-Interface.js` and related files.
  - Network communication uses axios and socket.io-client.
  - Authentication and feed server selection are handled by the root logic, with the GUI using these APIs for user login and data access.
- **State Management:** Zustand store keeps all UI and business state in sync, enabling reactive updates across components.
- **Error Handling:** Centralized error dialog displays errors from any part of the app.
- **Extensibility:** The separation between core logic and GUI allows rapid UI changes without affecting network/business logic. Adding new exchanges or subscription types requires changes only in the core logic, not the UI.

For a more detailed breakdown, see `exchange_web_GUI/FRONTEND_ARCHITECTURE.md`.

---

## Architectural Notes
- **Loose coupling:** All services communicate via Kafka, allowing independent scaling and deployment.
- **Extensible:** The architecture supports adding new exchanges and consumers with minimal changes.
- **Single consumer:** Currently, the web client is the only consumer, but the system can support additional consumers.
- **No hardcoded exchange logic:** The router and dispatcher are designed to be generic, with exchange-specific logic isolated in gateway services.

---

## Limitations and Recommendations
- **Exchange extensibility:** The system is well-structured for adding new exchanges, but ensure that new gateways follow the same message contract and topic conventions.
- **Topic management:** As the number of exchanges grows, consider automating topic creation and management.
- **Monitoring:** Add monitoring for Kafka topics and service health for production deployments.

---

*This document focuses on architecture. For deployment and environment details, see the README and docker-compose.yml.*
