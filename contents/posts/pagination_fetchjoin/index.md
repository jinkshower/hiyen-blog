---
title: "Spring Data JPA의 페이징처리와 fetch join시의 문제점"
description: "Spring Data Jpa의 페이지네이션과 이와 관련될 수 있는 문제 해결"
date: 2024-03-14
update: 2024-03-14
tags:
  - jpa
  - querydsl
  - pagination
series: "jpa"
---


*문제를 해결한 [코드](https://github.com/jinkshower/Todo-management)링크*

## 페이징 처리의 필요성

1. **성능**: 대량의 데이터를 한 번에 로드하면 메모리 부족이나 느린 쿼리 실행으로 인해 성능이 저하될 수 있다. 페이징 처리를 사용하면 사용자가 필요로 하는 작은 일부 데이터만 로드하여 성능을 향상시킬 수 있다.
    
2. **사용자 경험**: 사용자가 대량의 데이터를 한 번에 볼 필요는 없으며, 보통은 페이지별로, 특히 최근기록 위주로 조회한다.
    
3. **네트워크 부하 감소**: 대량의 데이터를 한 번에 전송하면 네트워크 부하가 증가할 수 있다. 페이징 처리를 사용하여 각 페이지마다 필요한 데이터만 전송해 네트워크 오버헤드를 감소 시킬 수 있다.

## Spring Data Jpa에서 페이징 처리하기

JpaRepository는 PagingAndSortingRepository를 상속받고 있는데, 이를 사용하면 간편하게 페이징된 데이터를 조회할 수 있다.

간단한 페이징 예제코드
```java
public interface UserRepository extends JpaRepository<User, Long> {  
	Page<User> findAll(Pageable pageable);
}

@Service  
public class UserService {  
  
    @Autowired  
    private UserRepository userRepository;  
  
    public Page<User> getUsers(int page, int size) {  
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());  
        return userRepository.findAll(pageable);  
    }  
}
```

 현재 페이지와 페이지에 들어갈 데이터의 양, 정렬기준을 정해서 PageRequest의 스태틱 메서드를 사용해 Pageable을 구현할 수 있다. 이를 JpaRepository의 파라미터로 넘겨줄 시 `Page<T>`로 반환결과를 받을 수 있다

위 코드 실행시 
`SELECT * FROM user ORDER BY created_at DESC OFFSET ? LIMIT ?`
라는 쿼리로 offset과 limit을 실행하는 것을 확인할 수 있다. 

### `Slice<T> 와 Page<T>의 차이점`

위 코드는 반환타입으로 Page를 받았지만 `Slice<T>`로도 페이징 처리된 객체를 받을 수도 있다.
`Page<T>`와 `Slice<T>`의 가장 큰 차이점은 count 쿼리가 날아가냐, 아니냐의 차이이다.

`Page<T>`는 전체 페이지의 수를 포함한 페이징된 데이터를 반환한다.
즉 totalCount를 함께 조회하는 쿼리를 실행하여 결과에 포함시킨다.
게시판 형태의 페이징에 적합하다.

`Slice<T>`는 limit+1을 조회하여 다음 페이지의 존재여부만 확인한다.
따라서 totalCount를 함께 조회하는 쿼리를 실행하지 않는다.
더보기, 무한 스크롤 형태의 페이징에 적합하다. 

## QueryDSL에서 페이징 적용하기

동적쿼리 작성을 위해 QueryDSL을 사용할 경우 쿼리 메서드 체이닝에 `.offset()` 과 `.limit()` 을 추가하여 페이징 처리를 할 수 있다.

```java
public Page<Todo> findAll(Pageable pageable) {  
    // 페이징 정보를 적용하여 쿼리 실행  
    List<Todo> todos = queryFactory  
        .select(todo)  
        .from(todo)  
        .offset(pageable.getOffset())  
        .limit(pageable.getPageSize())  
        .fetch();  
  
    // 전체 개수를 조회  
    long totalSize = queryFactory  
        .select(todo.count())  
        .from(todo)  
        .fetchFirst();  
  
    // 페이징 처리된 결과를 Page 객체로 변환하여 반환  
    return new PageImpl<>(todos, pageable, totalSize);  
}
```

return 부분은 
`return PageableExecutionUtils.getPage(todos, pageable, () -> totalSize);`로 유틸리티 메서드를 사용해도 된다. (내부에서 PageImpl을 생성하므로 실제 동작은 같다)

## 일대다 관계의 fetch join

[이전글](https://jinkshower.github.io/querydsl_nplusone/) 에서 N+1 문제를 해결하기 위해 queryDSL의 fetchjoin()을 사용한 기록을 남긴 적이 있다. 
자세한 설명없이 코드에 distinct()를 추가했는데 이는 일대다 관계에서 fetch join할 시의 문제점 때문이었다.

- 데이터 중복
일대다 관계에서 fetch join을 사용하면 일의 엔티티와 다의 엔티티들과 조인된다. 이 때 일의 엔티티가 다의 엔티티 수만큼 중복되어 반환된다.

예를 들어 team(1)와 members(다)의 관계가 있을때 
```java
select(team)
.from(team)
.leftJoin(team.members).fetchJoin()
.where(team.name.eq("팀A"))
```
을 할 경우 
![Pasted image 20240314170134](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/69d8a341-e79e-49b8-8d04-274902180bad)
위의 그림 처럼 일(팀)에 맞는 다의 member를 조회하기 때문에 팀이름이 중복되어 나타난다.

따라서 
```java
List<Team> teams = queryFactory 
.select(team) 
.distinct() // 중복된 결과를 제거
.from(team) 
.leftJoin(team.members, member).fetchJoin() 
.where(team.name.eq("팀A")) 
.fetch();
```
처럼 distinct()를 사용하여 중복을 제거해 줘야 한다.

## 일대다 fetchJoin과 페이징 처리

그렇다면 distinct()를 사용하면 일대다 관계에서 페이징처리를 사용할 수 있을까? 

distinct()는 애플리케이션단에서 중복을 제거하는 것이기 때문에 데이터베이스로 날아가는 쿼리에는 영향을 주지 못한다. 

실제로 일대다 fetch join과 페이징 처리를 같이 사용해보자.
```java
    @Override  
    public Page<Todo> findAllByOrderByCreatedAtDesc(Pageable pageable) {  
        List<Todo> fetch = queryFactory.select(todo)
	        .distinct()  
            .from(todo)  
            .join(todo.user, user).fetchJoin()  
            .leftJoin(todo.comments, comment).fetchJoin()  
            .orderBy(todo.createdAt.desc())  
            .offset(pageable.getOffset())  
            .limit(pageable.getPageSize())  
            .fetch();  
        long totalSize = queryFactory  
            .select(todo.count())  
            .from(todo)  
            .fetchFirst();  
        return PageableExecutionUtils.getPage(fetch, pageable, () -> totalSize);  
    }
```

(테스트 코드)
```java
    @Test  
    void pageTest() {  
        for (int i = 0; i < 15; i++) {  
            todoRepository.save(Todo.builder()  
                .title(TEST_TODO_TITLE)  
                .content(TEST_TODO_CONTENT + 1)  
                .user(TEST_USER)  
                .likeCount(0L)  
                .build());  
        }  
  
        System.out.println(todoRepository.findAll().size());  
        Page<Todo> found = todoRepository.findAllByOrderByCreatedAtDesc(  
            PAGE_DTO.toPageable());  
        Pageable pageable = found.getPageable();  
        Sort sort = pageable.getSort();  
        // 페이지 정보  
        System.out.println("Sort (Sorted): " + sort.isSorted());  
        System.out.println("Sort (Unsorted): " + sort.isUnsorted());  
        System.out.println("Sort (Empty): " + sort.isEmpty());  
        System.out.println("Page Size: " + pageable.getPageSize());  
        System.out.println("Page Number: " + pageable.getPageNumber());  
        System.out.println("Offset: " + pageable.getOffset());  
        System.out.println("Is Paged: " + pageable.isPaged());  
        System.out.println("Is Unpaged: " + pageable.isUnpaged());  
  
        // 전체 페이지 정보  
        System.out.println("Total Pages: " + found.getTotalPages());  
        System.out.println("Total Elements: " + found.getTotalElements());  
        System.out.println("Is Last Page: " + found.isLast());  
        System.out.println("Current Page Number: " + found.getNumber() + 1);  
        System.out.println("Is First Page: " + found.isFirst());  
        System.out.println("Is Empty: " + found.isEmpty());  
        System.out.println("Size: " + found.getSize());  
        System.out.println("Number Of Elements: " + found.getNumberOfElements());  
    }
```

![Pasted image 20240314172138](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/ec87d6f5-5b59-46ad-b098-7e8c86037b03)
결과는 Pageable에서 명시한대로 페이징처리가 되지만

![Pasted image 20240314172411](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/fcafb7e9-b520-42ec-8102-fe1a513f5c64)
limit 이나 offset이 없는 쿼리가 날아감을 볼수 있고 
`firstResult/maxResults specified with collection fetch; applying in memory`라는 경고 메시지가 나오는 것을 확인할 수 있다. 

즉, 일대다에서 다에 해당하는 컬렉션을 모두 메모리에 적재해서 가져오고 그 다음에 페이징처리를 하기 때문에 메모리에 과부하가 갈 수 있다는 뜻이다.

## 해결책1. 페이지네이션 쿼리와 fetch join쿼리를 나눈다

fetch join과 페이지네이션을 동시에 사용할 수 없기 때문에 fetch join을 사용하지 않은 쿼리로 페이지네이션을 적용한 todo의 id를 쿼리하고 그 id리스트를 fetchjoin에서 in절에 사용한다면 위와 같은 문제가 일어나지 않을 거라고 생각했다. 

```java
public Page<Todo> findAllByOrderByCreatedAtDesc(Pageable pageable) {  
    JPAQuery<Long> idQuery = queryFactory.select(todo.id) //id조회
        .from(todo)  
        .orderBy(todo.createdAt.desc())  
        .offset(pageable.getOffset())  
        .limit(pageable.getPageSize());  
    List<Long> ids = idQuery.fetch();  
    JPAQuery<Todo> query = queryFactory.select(todo)  
        .from(todo)  
        .join(todo.user, user).fetchJoin()  
        .leftJoin(todo.comments, comment).fetchJoin()  
        .orderBy(todo.createdAt.desc())  
        .where(todo.id.in(ids));  //id로 조회
    List<Todo> fetch = query.fetch();  
    long totalSize = queryFactory.select(todo.id.countDistinct())  
        .from(todo)  
        .fetch().get(0);  
    return PageableExecutionUtils.getPage(fetch, pageable, () -> totalSize);  
}
```

![Pasted image 20240314173731](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/a14436e5-36f7-4f31-80d7-fe4c0d5ae833)
id쿼리에서 페이지네이션이 적용되고

![Pasted image 20240314173817](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/a6361d53-555b-431f-aaf3-909f7ef58aff)
id로 fetch join을 수행할때의 where 절

하지만 해당 방법은 다른 메서드에서도 fetch join을 사용할 경우 id를 조회하는 쿼리를 따로 작성해줘야 하는 불편함이 있다

## 해결책2. BatchSize적용

BatchSize는 부모 엔티티를 조회할때 연관된 자식 엔티티의 수를 제한하는 기능이다.
부모에서 자식엔티티 그래프를 탐색할때 N+1처럼 select가 부모엔티티의 수만큼 나가는게 아니라 이미 조회한 엔티티의 식별자 값을 모아서 where절에 자식 엔티티 조회 쿼리를 하나로 처리한다.
따라서 쿼리를 하나 추가함으로써 BatchSize에 명시한 만큼의 자식 엔티티를 한번에 조회할 수 있다.

BatchSize는 일대다 관계의 컬렉션에 어노테이션을 직접 명시하거나
```java
@BatchSize(size = 100)  
@OneToMany(mappedBy = "todo", cascade = {CascadeType.PERSIST,  
    CascadeType.REMOVE})  
private List<Comment> comments = new ArrayList<>();
```

설정 파일에 해당 설정을 추가해서 어플리케이션 전체에서 사이즈를 제한할 수도 있다
```java
spring.jpa.properties.hibernate.default_batch_fetch_size=100
```

(배치 사이즈 적용 후 쿼리)
```java
    public Page<Todo> findAllByOrderByCreatedAtDesc(Pageable pageable) {  
        List<Todo> fetch = queryFactory.select(todo)  
            .from(todo)  
            .orderBy(todo.createdAt.desc())  
            .offset(pageable.getOffset())  
            .limit(pageable.getPageSize())  
            .fetch();  
        long totalSize = queryFactory  
            .select(todo.count())  
            .from(todo)  
            .fetchFirst();  
        return PageableExecutionUtils.getPage(fetch, pageable, () -> totalSize);  
    }
```
fetch join을 사용할 필요가 없어졌다. 이미 지연로딩에 대한 대비책으로 batchsize를 두었기 때문이다. 

![Pasted image 20240314180406](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/b62e6d86-0a7d-4ddb-aef4-958582fe47f7)

배치 사이즈 추가로 나가는 in 쿼리
![Pasted image 20240314175431](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/d424779d-0804-4cdd-a227-df13995e8c17)

## 마치며

이렇게 Spring Data Jpa에서 페이징 처리와 일대다 관계에서 페이징 처리시 주의점과 해결책을 알아보았다. 

*틀린 부분이나 부족한 부분에 대한 피드백은 언제나 환영합니다*

---
참고

자바 ORM 표준 JPA 프로그래밍 - 김영한 저