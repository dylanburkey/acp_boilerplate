# Kosher Capital ACP Integration - Visual Flow Guide

## Overview Flow Diagram

This document provides visual representations of how the Kosher Capital integration works with ACP.

## 1. High-Level Integration Flow

```mermaid
graph TB
    subgraph "User Journey"
        A[User wants to deploy AI agent] --> B[Connects wallet to ACP/Butler]
        B --> C[Initiates deployment request]
    end
    
    subgraph "ACP Layer"
        C --> D{ACP receives request}
        D --> E[Creates job with ID]
        E --> F[Routes to Quick Deploy Service]
    end
    
    subgraph "Quick Deploy Processing"
        F --> G{Has payment hash?}
        G -->|No| H[Execute 3-tx deployment]
        G -->|Yes| I[Verify payment on-chain]
        
        H --> J[1. Create Personal Fund]
        J --> K[2. Transfer 50 USDC]
        K --> L[3. Enable Trading]
        
        I --> M{Payment valid?}
        M -->|No| N[Return error]
        M -->|Yes| O[Continue to API]
        L --> O
    end
    
    subgraph "Kosher Capital Integration"
        O --> P[Call Quick Deploy API]
        P --> Q[KC processes request]
        Q --> R[Returns deployment data]
    end
    
    subgraph "Response Flow"
        R --> S[Update transaction record]
        S --> T[Send webhook notification]
        T --> U[Return success to ACP]
        U --> V[User sees success]
        
        N --> W[Send failure notification]
        W --> X[Return error to ACP]
        X --> Y[User sees error]
    end
    
    style A fill:#e1f5e1
    style V fill:#c8e6c9
    style Y fill:#ffcdd2
```

## 2. Detailed Contract Deployment Flow

```mermaid
sequenceDiagram
    participant W as User Wallet
    participant QD as Quick Deploy Service
    participant F as Factory Contract
    participant U as USDC Contract
    participant PF as Personal Fund
    participant KC as Kosher Capital API
    
    Note over W,KC: User initiates deployment
    
    W->>QD: Request deployment
    activate QD
    
    Note over QD,F: Transaction 1: Create Fund
    QD->>F: createPersonalizedFunds(true, aiWallet, USDC)
    F->>F: Deploy new Personal Fund
    F-->>PF: New fund contract created
    F-->>QD: Return fund address + emit event
    
    Note over QD,U: Transaction 2: Payment
    QD->>U: transfer(PAYMENT_RECIPIENT, 50 USDC)
    U->>U: Deduct from wallet balance
    U-->>QD: Transfer confirmed
    
    Note over QD,PF: Transaction 3: Enable Trading
    QD->>PF: setTradingEnabled(true)
    PF->>PF: Update trading status
    PF-->>QD: Trading enabled
    
    Note over QD,KC: API Integration
    QD->>KC: POST /fundDetails/quick-deploy
    Note right of KC: {<br/>  agentName,<br/>  contractCreationTxnHash,<br/>  creating_user_wallet_address,<br/>  paymentTxnHash,<br/>  deploySource: "ACP"<br/>}
    KC-->>QD: Deployment confirmed
    
    QD-->>W: Success response
    deactivate QD
```

## 3. Status Monitoring Flow

```mermaid
graph LR
    subgraph "Client Monitoring"
        A[Status Check Request] --> B[Status API]
    end
    
    subgraph "Status API Endpoints"
        B --> C{Route}
        C -->|/health| D[Health Status]
        C -->|/api/deployments/:id| E[Single Deployment]
        C -->|/api/deployments| F[List Deployments]
        C -->|/api/statistics| G[Statistics]
    end
    
    subgraph "Data Source"
        E --> H[Transaction Tracker]
        F --> H
        G --> H
        H --> I[(In-Memory Store)]
    end
    
    subgraph "Response"
        D --> J[{status: ok}]
        E --> K[Deployment Details]
        F --> L[Paginated List]
        G --> M[Aggregate Stats]
    end
```

## 4. Error Handling Flow

```mermaid
flowchart TB
    A[Request Processing] --> B{Error Type?}
    
    B -->|Validation Error| C[Invalid Parameters]
    B -->|Blockchain Error| D[Transaction Failed]
    B -->|API Error| E[KC API Failed]
    B -->|Network Error| F[Connection Issue]
    
    C --> G[Return VALIDATION_ERROR]
    D --> H[Return PROCESSING_ERROR]
    E --> I[Return SERVICE_ERROR]
    F --> J[Return TIMEOUT_ERROR]
    
    G --> K[Update Transaction: Failed]
    H --> K
    I --> K
    J --> K
    
    K --> L[Send Failure Notification]
    L --> M[Log Error Details]
    M --> N[Return Error Response]
    
    style C fill:#ffe0b2
    style D fill:#ffccbc
    style E fill:#ffcdd2
    style F fill:#ef9a9a
```

## 5. Notification System Flow

```mermaid
graph TD
    subgraph "Deployment Complete"
        A[Deployment Result] --> B{Success?}
    end
    
    subgraph "Notification Creation"
        B -->|Yes| C[Create Success Notification]
        B -->|No| D[Create Failure Notification]
        
        C --> E[Include deployment data]
        D --> F[Include error details]
    end
    
    subgraph "Delivery Attempt"
        E --> G[Send to Callback URL]
        F --> G
        G --> H{Response OK?}
    end
    
    subgraph "Retry Logic"
        H -->|No| I[Wait & Retry]
        I --> J{Retries < Max?}
        J -->|Yes| G
        J -->|No| K[Log Failed Delivery]
    end
    
    subgraph "Webhook Events"
        H -->|Yes| L[Send Webhook Event]
        L --> M[agent.deployed or agent.deployment.failed]
    end
    
    subgraph "Completion"
        K --> N[Mark Complete]
        M --> N
        N --> O[Update Records]
    end
```

## 6. Transaction State Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Job received
    Created --> Processing: Start deployment
    
    Processing --> VerifyingPayment: Has payment hash
    Processing --> DeployingContracts: No payment hash
    
    VerifyingPayment --> CallingAPI: Payment valid
    VerifyingPayment --> Failed: Payment invalid
    
    DeployingContracts --> FundCreated: Tx 1 success
    FundCreated --> PaymentSent: Tx 2 success
    PaymentSent --> TradingEnabled: Tx 3 success
    TradingEnabled --> CallingAPI: All txs complete
    
    DeployingContracts --> Failed: Any tx fails
    FundCreated --> Failed: Tx fails
    PaymentSent --> Failed: Tx fails
    
    CallingAPI --> Completed: API success
    CallingAPI --> Failed: API error
    
    Completed --> NotificationSent: Send callback
    Failed --> NotificationSent: Send callback
    
    NotificationSent --> [*]: Process complete
```

## 7. Configuration and Environment Flow

```mermaid
graph TD
    subgraph "Environment Variables"
        A[.env file] --> B[Process.env]
    end
    
    subgraph "Configuration Loading"
        B --> C[constants.ts]
        B --> D[config module]
    end
    
    subgraph "Service Initialization"
        C --> E[QuickDeployService]
        D --> E
        
        C --> F[ContractUtils]
        D --> F
        
        C --> G[NotificationService]
        D --> G
    end
    
    subgraph "Runtime Configuration"
        E --> H{Environment?}
        H -->|Production| I[Use mainnet settings]
        H -->|Sandbox| J[Use test settings]
        H -->|Development| K[Use local settings]
    end
    
    subgraph "Contract Addresses"
        I --> L[Factory: 0x0fE1...]
        J --> M[Factory: 0xTEST...]
        K --> N[Factory: 0xLOCAL...]
    end
```

## 8. Testing Flow

```mermaid
graph TB
    subgraph "Test Setup"
        A[Start Mock KC Server] --> B[Port 4000]
        C[Start Quick Deploy] --> D[Port 3001]
        E[Run Test Script] --> F[Create test request]
    end
    
    subgraph "Test Execution"
        F --> G[Submit to Quick Deploy]
        G --> H{Mock mode?}
        H -->|Yes| I[Simulate blockchain]
        H -->|No| J[Real blockchain]
        
        I --> K[Call Mock KC API]
        J --> L[Call Real KC API]
    end
    
    subgraph "Verification"
        K --> M[Check response]
        L --> M
        M --> N[Verify in Status API]
        N --> O[Check notifications sent]
        O --> P[Validate transaction records]
    end
    
    style A fill:#e3f2fd
    style C fill:#e3f2fd
    style E fill:#fff3e0
    style M fill:#e8f5e9
```

## Key Integration Points

### 1. **ACP Interface**
- Receives `AgentRequest` with job ID and parameters
- Returns `AgentResponse` with success/error status

### 2. **Blockchain Interaction**
- Factory Contract: Creates personal funds
- USDC Contract: Handles payments
- Personal Fund: Manages trading status

### 3. **Kosher Capital API**
- Endpoint: `/fundDetails/quick-deploy`
- Authentication: `x-api-key` header
- Payload: Agent and transaction details

### 4. **Notification System**
- Callback URL: Configurable endpoint
- Webhook Events: Real-time status updates
- Retry Logic: Ensures delivery

### 5. **Monitoring**
- Status API: REST endpoints
- Transaction Tracker: State management
- Logging: Comprehensive audit trail

## Quick Reference

### Contract Flow
```
1. createPersonalizedFunds() → Fund Address
2. transfer() → Payment Hash
3. setTradingEnabled() → Success
```

### API Flow
```
POST /quick-deploy
Headers: x-api-key
Body: { agentName, contractCreationTxnHash, ... }
```

### Status Check
```
GET /api/deployments/{jobId}
Response: { status, agentName, txHashes, ... }
```

---

For implementation details, see the [Developer Guide](./kosher-capital-developer-guide.md).
