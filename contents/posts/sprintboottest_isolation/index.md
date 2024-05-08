---
title: "@SpringBootTest와 테스트격리"
description: "테스트 격리를 위한 여정"
date: 2024-03-04
update: 2024-03-10
tags:
  - spring
  - testing
  - testisolation
series: "todo"
---

완성된 코드는 [링크](https://github.com/jinkshower/Todo-management)에서 볼 수 있습니다. (글의 코드와 조금 다른 면이 있을 수 있습니다)

## @SpringBootTest와 @Transactional

@Transactional을 어노테이션 자체에서 포함하고 있는 @DataJpaTest와 달리 @SpringBootTest는 @Transactional을 가지고 있지 않다.

따라서 트랜잭션-롤백 환경을 @SprintBootTest에서 만들기 위해서는 
```java
@SpringBootTest  
@Transactional  
@Rollback  
public class ControllerTest {   
}
```
위 코드처럼 test 클래스에 @Transactional과 @Rollback을 명시해줘야 한다

## RandomPort를 사용할때의 @SpringBootTest

하지만 RestAssured와 같은 프레임워크를 사용하는 인수테스트에서는 어노테이션으로 Port를 지정하게 되는데 이 때 HTTP 클라이언트와 서버는 각각 다른 스레드에서 실행된다.

즉 @Transactional로 트랜잭션 설정을 해도 다른 스레드에서 커밋을 해버리기 때문에 테스트 격리가 되지 않는다. 

![Pasted image 20240304114747](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/b3265dbe-be08-44fb-892a-555a71f56e72)

각 테스트는 따로 실행했을 때 제대로 통과하는 테스트지만 같이 실행되었을 때 줄줄이 실패하는 모습을 볼 수 있다.

## 해결책 1. @DirtiesContext

가장 간단하게 테스트를 격리할 수 있는 방법이 있다.

`@DirtiesContext(classMode = ClassMode.BEFORE_EACH_TEST_METHOD)`
를 테스트 클래스 어노테이션으로 선언하여  각 테스트 메서드가 실행될 때마다 컨텍스트를 새로 로드함을 명시한다.

즉, 테스트 메서드마다 다른 컨텍스트를 사용하기 때문에 트랜잭션 외부에서 데이터를 커밋하여 변경하는 테스트에 영향받지 않고 각 메서드마다 db의 테이블을 새롭게 만들 수 있다.

![Pasted image 20240304115424](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/a32fed4a-4ded-4428-a449-cc9a7e093af3)

적용 이후 모든 테스트가 통과함을 확인할 수 있다.

### @DirtiesContext의 문제점
이렇게 편한 어노테이션이지만 치명적인 단점이 있으니 바로 속도가 많이 느리다는 것이다. 

원래 @SpringBootTest는 테스트 클래스에서 컨텍스트를 한 번 로드하고 이미 컨텍스트가 있다면 캐싱해서 사용하기 때문에 매번 컨텍스트를 다시 로드하는 @DirtiesContext는 필연적으로 속도가 느릴 수 밖에 없다.

## 해결책2. 매 테스트마다 테이블을 Truncate하기

위의 문제를 좀더 빠르게 해결할 수 없는 지 방법을 계속 찾아봤다.

일단 가장 먼저 @AfterEach에 테스트에서 사용하는 repository의 deleteAll() 메서드를 호출하는 방식을 적용해봤다. 

하지만 deleteAll()은 특정 엔티티에 대한 레코드를 삭제하므로 연관관계가 맺어져 있는 엔티티에 대한 삭제가 제대로 이루어지지 않았다.

따라서 테이블 데이터를 모두 삭제하는 truncate를 사용하게 되었다.

### h2의 truncate

테스트 db로 h2를 사용하고 있기 때문에 truncate 쿼리를 사용하기 위해서는 테이블의 제약조건을 무효화하고 실행해야 한다

따라서 
```java
SET REFERENTIAL_INTEGRITY FALSE
TRUNCATE ..
SET REFERENTIAL_INTEGRITY TRUE
```
로 truncate 이후 다시 제약조건을 걸어주는 쿼리를 작성해야 했다. 

```java
@AfterEach  
void clear() {  
    jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");  
    jdbcTemplate.execute("TRUNCATE TABLE users");  
    jdbcTemplate.execute("TRUNCATE TABLE todos");  
    jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");  
}
```
테스트 클래스 내에서 jdbcTemplate를 사용해 쿼리를 작성해서 실행 시켜 줬다.

![Pasted image 20240304122429](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/8d152e82-5e91-4699-afa0-7a5bade9685a)

@DirtiesContext사용 보다 총 테스트 시간이 절반으로 줄어든 모습

### 아쉬운 점

이렇게 빠른 테스트 속도와 격리를 얻어냈지만 아쉬움이 남았다.
매번 @AfterEach에 위의 코드를 작성해야 한다는 점, 테이블이 늘어나면 그만큼 쿼리문도 늘어나는 단점을 여전히 가지고 있다.

## 관심사 분리

관심사를 분리하여 @AfterEach에 있는 데이터베이스 초기화 코드를 다른 클래스로 분리하면 매번 테이블을 확인할 필요도 없고, 다른 테스트 클래스에도 재사용할 수 있지 않을까?

테스트마다 생성된 테이블의 이름을 얻어내 각각을 truncate쿼리를 자동으로 만든다면 가능할 것 같다.

### 테이블 이름 얻기

대부분의 관계형 데이터베이스는 생성된 테이블들의 메타정보를 가지고 있는 정보성 테이블이 존재한다. 

h2는 information_schema라는 테이블에 메타정보를 저장하는데, 해당 테이블에 있는 모든 메타정보는 [공식문서](https://www.h2database.com/html/systemtables.html)를 참고하면 될 것같다.

내가 관심있는건 테이블이름들이니
```java
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'
```
라는 쿼리를 작성하면 될 것같다. 

### truncate 쿼리 작성

이렇게 얻은 테이블 이름을 자료구조에 저장하고 각 테이블이름마다 반복하여
```java
TRUNCATE TABLE " + tableName + " RESTART IDENTITY
```
를 실행하면 직접 일일히 입력해주지 않아도 쿼리문이 실행될 것이다.

작성한 코드
```java
public class TableCleaner {  
  
    private List<String> tableNames;  
    private JdbcTemplate jdbcTemplate;  
  
    @Autowired  
    public DatabaseCleaner(DataSource dataSource) {  
        this.jdbcTemplate = new JdbcTemplate(dataSource);  
    }  
  
    @Transactional  
    public void tableClear() {  
        String query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'";  
        tableNames = jdbcTemplate.queryForList(query, String.class);  
  
        jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");  
        for (String tableName : tableNames) {  
            jdbcTemplate.execute("TRUNCATE TABLE " + tableName + " RESTART IDENTITY ");  
        }  
        jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");  
    }  
}
```

이렇게 작성한 클래스를 컴포넌트로 등록해줘서 테스트 실행시 컴포넌트 스캔에 잡히게 해주면 해당 클래스를 빈으로 사용할 수 있고, 

```java
@Component  
public abstract class TestSupporter {  
  
    @Autowired  
    private TableCleaner tableCleaner;  
  
    @AfterEach  
    void clear() {  
        tableCleaner.tableClear();  
    }  
}
```
해당 클래스로 주입받은 뒤 데이터베이스 초기화가 필요한 테스트에 상속받아 사용하면 테스트 생명주기에 맞춰 @AfterEach가 실행되며 자동으로 데이터베이스가 초기화되어, 테스트 격리가 될 것이다.

*틀린 부분이나 부족한 부분에 대한 피드백은 언제나 환영합니다*

---
참고

https://tecoble.techcourse.co.kr/post/2020-09-15-test-isolation/







