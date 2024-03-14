---
title: "Querydsl과 JPA에서의 N+1문제"
description: "검색기능을 Querydsl로 개선하면서 만난 N+1문제를 해결한 기록 "
date: 2024-03-10
update: 2024-03-10
tags:
  - jpa
  - querydsl
series: "jpa"
---


리팩토링 과제 중 검색기능을 Querydsl로 개선하면서 만난 N+1문제를 해결한 기록 [코드링크](https://github.com/jinkshower/Todo-management)

## 검색기능

jpa에 대한 학습이 부족하던 떄, 과제에서 검색기능을 만든 경험이 있다.
```java
    @GetMapping("/todos/filter")
    public ResponseEntity<CommonResponse<List<TodoResponseDto>>> getFilteredTodos(
            @RequestParam(defaultValue = "false") Boolean completed,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String title,
            @Login UserDto userDto) {
        List<TodoResponseDto> todoResponseDtos = todoService.getFilteredTodos(completed, userId, title, userDto);
        return ResponseEntity.ok().body(CommonResponse.<List<TodoResponseDto>>builder()
                        .statusCode(HttpStatus.OK.value())
                        .message("검색 결과가 조회되었습니다.")
                        .data(todoResponseDtos).build());
    }
```
(서비스 호출메서드 생략)
```java
public class Todos {

    private final List<Todo> todos;
    private final List<SearchFilter> filters = new ArrayList<>();

    public Todos(List<Todo> todos) {
        this.todos = new ArrayList<>(todos);
        initializeFilters();
    }

    private void initializeFilters() {
        filters.add(new AuthorSearchFilter());
        filters.add(new TitleSearchFilter());
        filters.add(new StatusSearchFilter());
    }

    public List<Todo> filter(Object ...parameters) {
        List<Todo> filtered = new ArrayList<>(todos);

        for (Object object: parameters) {
            if (object == null) {
                continue;
            }
            SearchFilter searchFilter = findFilter(object);
            filtered = searchFilter.apply(filtered, object);
        }

        return filtered.stream()
                .sorted(Comparator.comparing(Timestamped::getCreatedAt).reversed())
                .toList();
    }

    private SearchFilter findFilter(Object object) {
        return filters.stream()
                .filter(filter -> filter.supports(object))
                .findFirst()
                .orElseThrow(() -> new InvalidInputException("유효한 입력이 아닙니다."));
    }
}
```

SearchFilter를 전략패턴과 어댑터패턴을 활용하여 필터 기능을 구현한 코드였다.
그렇게 나쁜 코드는 아니지만 단점이 많은 코드라는 생각이 들었다.

### 문제점

1. Controller에서 @RequestParam으로 검색 조건을 받고 있기 때문에 검색조건이 늘어나면 파라미터가 계속 늘어날 수 있다.
2. 가변인자 Object로 검색조건들을 받고 이에 맞는 filter를 선택해야하는데 지금은 모두 타입이 다르지만 같은 타입의 파라미터가 추가되어야하면 이를 다른 클래스로 구현해야한다.
3. 검색조건이 늘어나면 그만큼 필터의 구현클래스도 늘어나야한다.

즉, 확장하는데 불편함이 많은 코드다.

그렇게 아쉬운 마음을 가진채로 공부를 이어가다 jpa에서 동적쿼리를 사용할 수 있는 방법을 알게 되었고, 해당 기능을 개선하기로 했다.

Jpql자체로 혹은 Criteria, Specification을 사용하는 방법이 있는데 이에 대한 자세한 설명은 [링크](https://tecoble.techcourse.co.kr/post/2022-10-11-jpa-dynamic-query/)에 잘 설명이 되어있다. 

나는 가장 가독성이 좋다고 느껴진 Querydsl을 활용했다.

## Querydsl 적용하기

Querydsl을 적용하는데 다양한 방법이 있지만, 나는 JpaRepository 인터페이스가 제공하는 기본 CRUD는 사용하되 동적쿼리가 필요한 메서드는 직접 구현하고 싶었다.

그래서 TodoQueryRepository라는 인터페이스에 동적쿼리가 필요한 메서드를 작성하고 이를 TodoRepositoryImpl에서 구현하였다.

레포지토리+Impl이라는 명명 규칙을 지킬경우 Spring Data Jpa가 자동으로 빈으로 등록해주기 때문에 기본 인터페이스 메서드 + 구현의 동적쿼리를 함께 주입받아 하나의 객체로 사용할 수 있다.

JPAQueryFactory는 [동욱님의 글](https://jojoldu.tistory.com/372)을 참고하도록 하자

(작성한 Impl 코드)
```java
@RequiredArgsConstructor  
public class TodoRepositoryImpl implements TodoQueryRepository {  
  
    private final JPAQueryFactory queryFactory;  
  
    public List<Todo> findAllByOrderByCreatedAtDescc() {  
        return queryFactory  
            .select(todo)  
            .from(todo)   
            .orderBy(todo.createdAt.desc())  
            .fetch();  
    }  
  
    public List<Todo> searchByFilter(TodoSearchFilter todoSearchFilter) {  
        return queryFactory  
            .select(todo)  
            .from(todo)  
            .where(  
                eqAuthor(todoSearchFilter.getUserId()),  
                eqTitle(todoSearchFilter.getTitle()),  
                eqStatus(todoSearchFilter.getTodoStatus())  
            )  
            .fetch();  
    }  
  
    private BooleanExpression eqTitle(String title) {  
        if (StringUtils.isEmpty(title)) {  
            return null;  
        }  
        return todo.title.eq(title);  
    }  
  
    private BooleanExpression eqAuthor(Long userId) {  
        if (userId == null) {  
            return null;  
        }  
        return todo.id.eq(userId);  
    }  
  
    private BooleanExpression eqStatus(TodoStatus status) {  
        return todo.todoStatus.eq(status);  
    }  
}
```

BooleanExpression은 null반환시 자동으로 조건절에서 제거된다.
다만 모든 조건이 null일 경우 전체 결과가 그냥 반환되버리니 주의해야 한다.

나는 검색조건을 클래스로 만들어서 @ModelAttribute로 컨트롤러에서 받고 이를 사용했다. 

![Pasted image 20240310220132](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/6c6f31c6-a0fe-4de3-9645-7f3a8e9287d6)
생성된 쿼리에서 내가 원하던 조건이 where절에 생성된 쿼리를 확인할 수 있었다. 

### 그런데 Select가 마구잡이로 나간다? 

쿼리를 다시 보는 중 모든 할일목록을 조회하는 기능에서 select쿼리가 잔뜩 나가는 모습을 확인되었다.

![Pasted image 20240310144552](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/934aab65-eefb-415a-a317-2c87f4d34c1c)
(엄청난 스크롤의 쿼리 중 일부)

## N+1문제

JPA에서 N+1문제란 조회한 엔티티와 연관된 엔티티를 가져올때마다 N(조회한 엔티티수)만큼 추가적인 쿼리가 발생하는 상황을 말한다. 

나의 경우에 Todo는 User, Comment와 연관관계를 맺고 있기 때문에 todo를 조회할때 조회한 개수만큼 3배의 쿼리가 발생한 것이다.

### 즉시로딩과 지연로딩

JPA에서는 연관관계를 설정할 때, 즉시로딩(EAGER loading)과 지연로딩(LAZY loading) 두 가지 방식을 선택할 수 있다.

1. 즉시로딩 (EAGER loading): 연관된 엔티티를 즉시 조회하는 방식으로, 연관된 엔티티를 함께 가져와서 메모리에 로드합니다. 즉시로딩은 `@ManyToOne` 또는 `@OneToOne` 관계에서 기본 설정이다.

2. 지연로딩 (LAZY loading): 연관된 엔티티를 실제로 사용할 때 조회하는 방식으로, 연관된 엔티티를 사용할 때에는 해당 엔티티에 대한 쿼리가 실행되어 로드된다. `@OneToMany` 또는 `@ManyToMany` 관계에서 기본 설정이다.

대부분의 경우 성능을 위해서 글로벌 페치전략을 지연로딩으로 설정한다. (즉시 로딩은 필요없는 연관관계의 엔티티도 즉시 조회하므로)

### 프록시

지연로딩으로 객체 그래프를 탐색할때 JPA는 실제객체가 사용될때(ex: getName()) 실제 엔티티를 조회하는데 그 전에는 프록시 객체를 제공한다.

```java
Todo todo = em.find(Todo.class, id);
todo.getComments()// 프록시 객체, sql은 todo 관련 한번만 나간다
```

이때
```java
for (Comment comment: comments) {
	//객체 사용 로직.. sql 다량 발생
}
```
와 같이 컬렉션을 초기화하면 그 수만큼 연관관계가 맺어진 엔티티를 조회하는 쿼리가 나가게 된다.

나는 조회한 할일목록을 스트림으로 dto로 반환하고 있었다.
```java
//service method
@Transactional(readOnly = true)  
@Override  
public List<TodoResponseDto> getAllTodos() {  
    return todoRepository.findAllByOrderByCreatedAtDesc().stream()  
        .map(TodoResponseDto::new)  
        .toList();  
}
//dto
public TodoResponseDto(Todo todo) {  
    this.id = todo.getId();  
    this.title = todo.getTitle();  
    this.content = todo.getContent();  
    this.author = todo.getUser().getName();//초기화
    this.status = todo.getTodoStatus();  
    this.createdAt = todo.getCreatedAt();  
  
    for (Comment comment : todo.getComments()) {  
        comments.add(new CommentResponseDto(comment.getContent()));//초기화
    }  
}
```
즉 지연로딩된 연관객체들이 스트림의 반복 + foreach의 반복에서 초기화되면서 엄청난 양의 쿼리가 발생하게 된것이다. 

## N+1문제 해결

### fetch join

N+1의 해결책은 여러가지 방법이 있는데 가장 일반적인 방법은 페치조인을 사용하는 방법이다. 

페치 조인은 일반조인과 조금 다른데, 일반 조인은 조인된 엔티티들의 필드를 가져오지만 페치 조인은 연관된 엔티티를 함께 조회하여 결과로 가져온다. 

페치조인은 쿼리를 실행하는 시점에서 연관된 엔티티들을 함께 조회하기 때문에 한번의 쿼리로 모든 데이터를 가져올 수 있다. 이에 반해 일반 조인은 연관된 엔티티들을 조회하기 위해 추가적인 쿼리가 발생할 수 있다. 

```java
public List<Todo> findAllByOrderByCreatedAtDescc() {  
    System.out.println("called");  
    return queryFactory  
        .select(todo)
        .distinct()  
        .from(todo)  
        .join(todo.user, user).fetchJoin()  
        .leftJoin(todo.comments, comment).fetchJoin()  
        .orderBy(todo.createdAt.desc())  
        .fetch();  
}  
  
public List<Todo> searchByFilter(TodoSearchFilter todoSearchFilter) {  
    return queryFactory  
        .select(todo)  
        .distinct()
        .from(todo)  
        .join(todo.user, user).fetchJoin()  
        .leftJoin(todo.comments, comment).fetchJoin()  
        .where(  
            eqAuthor(todoSearchFilter.getUserId()),  
            eqTitle(todoSearchFilter.getTitle()),  
            eqStatus(todoSearchFilter.getTodoStatus())  
        )  
        .fetch();  
}
```
user는 필수 포함이기 때문에 inner join(join시 생략 가능)을 사용했고 comments는 없을 수도 있는 필드이므로 left join을 사용했다. (없을 수도 있는 필드에 inner join을 해버리면 todo 자체가 포함되지 않기 때문에 무결성이 깨진다)

(실행 결과)
![Pasted image 20240310164055](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/c20bbb82-3291-4704-bd49-1ba2ddfce63d)

### EntityGraph사용

@EntityGraph도 마찬가지로 EntityGraph 상에 있는 Entity들의 연관관계 속에서 필요한 엔티티와 컬렉션을 함께 조회하려고 할때 사용한다. 
어노테이션으로 fetch join을 사용할 수 있게 해준다고 생각하면 쉽다.

```java
public interface TodoRepository extends JpaRepository<Todo, Long> {  
  
    @EntityGraph(attributePaths = {"comments", "user"}, type = EntityGraphType.LOAD)  
    List<Todo> findAllByOrderByCreatedAtDesc();  
}
```

`attributePaths`에 같이 조회할 연관엔티티를 작성하면 된다.

`type`은 `EntityGraphType.LOAD`, `EntityGraphType.FETCH` 2가지가 있다

- `LOAD` 
attributePaths에 정의한 엔티티들은 EAGER, 나머지는 글로벌 패치 전략에 따라 패치한다
일단 attributePaths 는 EAGER, 나머지는 매핑 설정 따라서

- `FETCH` 
attributePaths에 정의한 엔티티들은 EAGER, 나머지는 LAZY로 패치한다 

(실행결과)
![Pasted image 20240310200026](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/7b5e472b-196a-4011-b888-40d2c78ac513)

*틀린 부분이나 부족한 부분에 대한 피드백은 언제나 환영합니다*

---
참고

자바 ORM 표준 JPA 프로그래밍 - 김영한 저
