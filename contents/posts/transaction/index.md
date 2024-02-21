---
title: "Transaction"
description: "트랜잭션과 ACID특징"
date: 2024-02-21
update: 2024-02-21
tags:
  - database
  - transaction
series: "database"
---

## 트랜잭션(Transaction)

트랜잭션은 데이터베이스에서 수행되는 작업의 단위를 나타내며, 더 이상 쪼갤 수 없는 쿼리들의 묶음을 말한다. 트랜잭션은 ACID 특징을 따르며, ACID는 원자성(Atomicity), 일관성(Consistency), 격리성(Isolation), 지속성(Durability)을 나타낸다.

## ACID 특징

### 1. 원자성(Atomicity)

- 트랜잭션을 구성하는 작업들은 모두 성공하거나 모두 실패하는 특성을 갖는다.
- 중간 단계에서 오류가 발생하면 이전 상태로 롤백되어 어떠한 영향도 주지 않아야한다.

### 2. 일관성(Consistency)

- 트랜잭션 실행 전과 실행 후에 데이터베이스는 일관된 상태를 유지해야 한다
- 트랜잭션은 데이터베이스의 무결성 제약조건을 만족해야 한다

### 3. 격리성(Isolation)

- 동시에 여러 트랜잭션이 실행될 때, 각 트랜잭션은 서로 간섭받지 않고 독립적으로 실행되는 특성
- 특정 트랜잭션이 다른 트랜잭션의 작업을 볼 수 없다

### 4. 지속성(Durability)

- 트랜잭션이 성공적으로 완료되면 그 결과는 영구적으로 저장되어야 한다
- 시스템 장애 또는 다시 시작해도 데이터베이스는 변하지 않아야 한다

## Commit과 Rollback 연산

### Commit

- 트랜잭션의 모든 작업이 성공적으로 완료되었고, 결과를 데이터베이스에 반영하는 명령
- Commit이 수행되면 트랜잭션은 영구적으로 적용된다

### Rollback

- 트랜잭션의 실패나 에러가 발생한 경우, 이전 상태로 되돌리는 명령
- 데이터베이스에 아무런 영향을 미치지 않은 것처럼 트랜잭션을 취소한다.

---
참고

https://docs.oracle.com/en/database/oracle/oracle-database/19/cncpt/transactions.html