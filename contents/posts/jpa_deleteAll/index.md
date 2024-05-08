---
title: "JPA deleteAll()을 사용할 시 문제점"
description: "JPA deleteAll()시 n번의 쿼리를 해결한 기록"
date: 2024-03-31
update: 2024-03-31
tags:
  - jpa
series: "todo"
---

## 학습계기

팀 프로젝트 중 테스트를 해보며 쿼리를 살펴보고 있는데 이상하게 delete 쿼리가 많이 나가는 현상을 발견했습니다.

![Pasted image 20240321160655](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/da7e70e0-3700-4c46-b0d8-389a35a193b1)

문제가 되는 repository의 코드입니다.
```java
@Override  
public void deleteCard(Long cardId) {  
    cardJpaRepository.deleteById(cardId);  
    assignJpaRepository.deleteAllByCardId(cardId);  
}
```

카드에 할당자가 여러명 존재할 수 있기 때문에 카드를 삭제할때 해당 카드에 할당된 사용자를 모두 삭제해줘야 했는데, 

처음 생각은 deleteAll이면 쿼리로 `delete from assigns where card_id = ?`로 하나의 쿼리가 나갈 줄 알았는데 아니었습니다.

## 분석

이유를 알아보기 위해 deleteAll()을 수행하는 jpaRepository가 상속하는 ListCrudRepository를 살펴보았습니다. ListCrudRepository는 CrudRepository를 상속받고 있었는데요, 해당 인터페이스에서 

```java
void deleteAll(Iterable<? extends T> entities);
```
엔티티 목록을 삭제하는 메서드를 찾을 수 있었고  
해당 인터페이스의 메서드는 SimpleJpaRepository에서 구현하고 있었습니다.

(SimpleJpaRepository의 deleteAll 구현 메서드)
```java
@Transactional  
public void deleteAll(Iterable<? extends T> entities) {  
    Assert.notNull(entities, "Entities must not be null");  
    Iterator var3 = entities.iterator();  
  
    while(var3.hasNext()) {  
        T entity = (Object)var3.next();  
        this.delete(entity);  
    }  
  
}
//
@Transactional  
public void delete(T entity) {  
    Assert.notNull(entity, "Entity must not be null");  
    if (!this.entityInformation.isNew(entity)) {  
        Class<?> type = ProxyUtils.getUserClass(entity);  
        T existing = this.entityManager.find(type, this.entityInformation.getId(entity));  
        if (existing != null) {  
            this.entityManager.remove(this.entityManager.contains(entity) ? entity : this.entityManager.merge(entity));  
        }  
    }  
}
```
deleteAll이 iterator를 통해 파라미터로 전달된 엔티티 목록을 순회하며 this.delete메서드를 호출하고 있는 것을 확인할 수 있었습니다.

또한 this.delete(entity)에서 호출하는 delete메서드를 살펴보면 isNew()를 통해 파라미터의 엔티티가 1차 캐시에 존재하는지 확인하고 그렇지 않다면 entityManager.find()를 통해 데이터베이스에 select 쿼리를 보내는 구조라는 것을 알 수 있습니다.

따라서 이 deleteAll()이라는 쿼리 메서드를 사용하면 저의 의도와는 다르게 select 쿼리 + n개의 delete쿼리가 다량 발생하는 문제가 발생했습니다.

## 해결 

해당 쿼리 메서드의 문제점을 파악하고 jpql로 벌크연산 쿼리를 작성하였습니다. 
```java
@Modifying(clearAutomatically = true)
@Query("delete from AssignEntity a where a.cardId = :cardId") 
void deleteAllByCardId(@Param("cardId") Long cardId);
```

벌크성 연산임을 알리기 위해 @Modifying 어노테이션을 추가해주었고, 영속성 컨텍스트를 거치는 것이 아니라 데이터베이스에 바로 쿼리를 날리기 때문에 영속성 컨텍스트에 있는 데이터와 정합성을 해칠 수 있기 때문에 (삭제 했는데 조회가 된다던가) clearAutomatically = true로 해당 메서드 수행 후 영속성을 초기화해주게 설정했습니다.

jpql로 메서드 변경후 하나의 쿼리만 나가는 것을 확인했습니다.
![Pasted image 20240321160245](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/01b4a536-2749-41c4-9892-b390b154ac4d)

## deleteAllinBatch() 잠깐 살펴보기

이렇게 문제를 해결했지만 SimpleJpaRepository의 메서드들을 살펴보며deleteAllInBatch(), deleteAllByIdInBatch()가 눈에 띄었습니다.

```java
@Transactional  
public void deleteAllInBatch(Iterable<T> entities) {  
    Assert.notNull(entities, "Entities must not be null");  
    if (entities.iterator().hasNext()) {  
        QueryUtils.applyAndBind(QueryUtils.getQueryString("delete from %s x", this.entityInformation.getEntityName()), entities, this.entityManager).executeUpdate();  
    }  
}

@Transactional  
public void deleteAllByIdInBatch(Iterable<ID> ids) {  
    Assert.notNull(ids, "Ids must not be null");  
    if (ids.iterator().hasNext()) {  
        if (this.entityInformation.hasCompositeId()) {  
            List<T> entities = new ArrayList();  
            ids.forEach((id) -> {  
                entities.add(this.getReferenceById(id));  
            });  
            this.deleteAllInBatch(entities);  
        } else {  
            String queryString = String.format("delete from %s x where %s in :ids", this.entityInformation.getEntityName(), this.entityInformation.getIdAttribute().getName());  
            Query query = this.entityManager.createQuery(queryString);  
            if (Collection.class.isInstance(ids)) {  
                query.setParameter("ids", ids);  
            } else {  
                Collection<ID> idsCollection = (Collection)StreamSupport.stream(ids.spliterator(), false).collect(Collectors.toCollection(ArrayList::new));  
                query.setParameter("ids", idsCollection);  
            }  
  
            this.applyQueryHints(query);  
            query.executeUpdate();  
        }  
  
    }  
}
```
deleteAllInBatch() 메서드의 내부를 살펴보니 QueryUtils로 제가 원하던 `delete from` 쿼리를 생성하고 executeUpdate()로 실행하는 메서드로 파악했습니다.

deleteAllByIdInBatch()는 일단 복합키인지를 확인하고 복합키라면 id에 해당하는 엔티티를 찾아서 deleteAllInBatch()를 사용하고 아니라면 바로 `delete from`쿼리를 실행하는 메서드로 보입니다!

id리스트로 삭제가 필요하던가, 엔티티 리스트를 삭제할때는 deleteAllInBatch()를 사용하면 좋을 것 같습니다.


