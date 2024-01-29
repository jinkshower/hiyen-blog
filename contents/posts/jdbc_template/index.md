---
title: "JDBC 에서 JDBC Template"
description: "JDBC Template는 어떻게 생겨났을까? JDBC코드를 개선하며 살펴보는 기록"
date: 2024-01-29
update: 2024-01-29
tags:
  - spring
  - jdbc
  - designpattern
series: "spring"
---


JDBC Template는 어떻게 생겨났을까? JDBC코드를 개선하며 살펴보는 기록

## JDBC template가 있기 전

간단하게 users 테이블에 User를 저장하고 삭제하는 UserDao 메서드들을 JDBC로 작성해봤다
DataSource는 `SimpleDriverDataSource`클래스를 주입받아 사용하고 있다.

```java
public void add(User user) throws SQLException {  
    Connection c = null;  
    PreparedStatement ps = null;  
  
    try {  
        c = dataSource.getConnection();  
        ps = c.prepareStatement("insert into users(id, name, password) value(?,?,?)");  
        ps.setString(1, user.getId());  
        ps.setString(2, user.getName());  
        ps.setString(3, user.getPassword());  
  
        ps.executeUpdate();  
    } catch (SQLException e) {  
    } finally {  
        if (ps != null) {  
            try{  
                ps.close();  
            } catch (SQLException e) {  
            }  
        }  
        if (c != null) {  
            try {  
                c.close();  
            } catch (SQLException e) {  
            }  
        }  
    }  
}

public void delete() throws SQLException {  
    Connection c = null;  
    PreparedStatement ps = null;  
  
    try {  
        c = dataSource.getConnection();  
        ps = c.prepareStatement("delete from users");  
        ps.executeUpdate();  
    } catch (SQLException e) {  
    } finally {  
        if (ps != null) {  
            try{  
                ps.close();  
            } catch (SQLException e) {  
            }  
        }  
        if (c != null) {  
            try {  
                c.close();  
            } catch (SQLException e) {  
            }  
        }  
    }  
}
```

자원을 쓰는 부분을 모두 null 체크를 하고 반환해줘야 하기 때문에 try-catch-finally 중 제외할 부분은 없다.

일단 catch하는 부분은 비워놨는데 여기서 예외처리를 추가하면 코드는 더 길어질 것이다. 

위 코드는 아무런 문제가 없지만 간단한 기능들을 쓰는데 이만한 코드를 작성하는 게 맞나?라는 생각이 들 수 밖에 없다. 

더 문제인 점은 db에 접근하는다른 기능을 만드려면 위 코드와 아주 유사한 메소드를  똑같이 생성해줘야 한다는 점이다.

## 전략패턴 활용

전략패턴을 활용하여  반복되는 부분을 줄여볼 수 있을 것 같다.

우리가 관심 있는 부분은 쿼리문이 바뀌는 ps 부분이니 이 부분을 interface화 하고,우리가 원하는 기능을 implement하는 클래스로 만들고, 반복되는 부분에는 전략의 구현클래스를 주입 받도록 할 수 있을 것이다. 

interface 클래스
```java
public interface StatementStrategy {  
    PreparedStatement makePreparedStatement(Connection c) throws SQLException;  
}
```

add와 delete 클래스
```java
public class AddStatement implements StatementStrategy {  
    User user;    //add 는 user가 필요하니 주입 받는다
    public AddStatement(User user) {  
        this.user = user;  
    }  
    @Override  
    public PreparedStatement makePreparedStatement(Connection c) throws SQLException {  
        PreparedStatement ps = c.prepareStatement("insert into users(id, name, password) value(?,?,?)");  
        ps.setString(1, user.getId());  
        ps.setString(2, user.getName());  
        ps.setString(3, user.getPassword());  
        return ps;  
    }  
}

public class DeleteStatement implements StatementStrategy {  
    @Override  
    public PreparedStatement makePreparedStatement(Connection c) throws SQLException {  
        PreparedStatement ps = c.prepareStatement("delete from users");  
        return ps;  
    }  
}
```

전략패턴을 활용하여 구현체를 주입받기
```java
public void jdbcWithStatementStrategy(StatementStrategy statement) throws SQLException {  
    Connection c = null;  
    PreparedStatement ps = null;  
  
    try {  
        c = dataSource.getConnection();  
        ps = statement.makePreparedStatement(c);//구현체마다 다른 ps를 받을 수 있다
  
        ps.executeUpdate();  
    } catch (SQLException e) {  
        throw e;  
    } finally {  
        close(ps, c);  
    }  
}  
  
private void close(PreparedStatement ps, Connection c) throws SQLException {  
    if (ps != null) {  
        try {  
            ps.close();  
        } catch (SQLException e) {  
        }  
    }  
    if (c != null) {  
        try {  
            c.close();  
        } catch (SQLException e) {  
        }  
    }  
}
  
```

전략패턴을 사용하는 add, delete 메서드
```java
public void add(User user) throws SQLException {  
    StatementStrategy st = new AddStatement(user);  
    jdbcWithStatementStrategy(st);  
}

public void delete() throws SQLException {  
    StatementStrategy st = new DeleteStatement();  
    jdbcWithStatementStrategy(st);  
}
```


구체화된 전략클래스들을 주입받아 실행하는 추상화된 메서드를 만들었다. close()또한 메서드 추출을 진행했다.

이제 우리는 필요한 기능이 생길때 interface를 상속받은 클래스를 만들고 해당 메서드를 이용만 하면 된다.

처음 코드와 비교해보면 add, delete의 코드 라인 수가 훨씬 많이 줄었다.

그리고 다른 기능이 추가 구현되어도 전략 클래스를 새로 만들고 추상화된 메서드에 파라미터로 넣는 간단한 기능만 만들면 되니 확장성을 갖췄다고도 볼 수 있다.

하지만 전통적인 전략패턴의 문제점을 여전히 가지고 있는데, 바로 구현클래스가 계속 늘어나는 단점이다. 또한 add(), delete()가 직접 전략의 구현체를 생성하는 것도 확장성에 문제를 일으킬 수 있다.

## 템플릿/ 콜백 패턴

`템플릿/콜백 패턴` 이란

중복되는 부분이 있는 코드에서 변경이 일어나지 않는 부분을 `템플릿`, 변경이 일어나는 부분을 `콜백`으로 분리하여 변화되는 부분만 인자로 넘겨주는 디자인 패턴이다

전략패턴으로 개선한 위의 UserDao를 템플릿/콜백으로 더 개선해볼 수 있다.

```java
public class JDBCContext {  
  
    private DataSource dataSource;  
  
    public JDBCContext(DataSource dataSource) {  
        this.dataSource = dataSource;  
    }  
//주목! 
public void executeSql(final String query, String... args) throws SQLException {  
    jdbcWithStatementStrategy(c -> {  
                PreparedStatement ps = c.prepareStatement(query);  
                for (int i = 0; i < args.length; i++) {  
                    ps.setString(i + 1, args[i]);  
                }  
                return ps;  
            }  
    );  
}
  
private void jdbcWithStatementStrategy(StatementStrategy stmt) throws SQLException {  
        Connection c = null;  
        PreparedStatement ps = null;  
  
        try {  
            c = dataSource.getConnection();  
            ps = stmt.makePreparedStatement(c);  
  
            ps.executeUpdate();  
        } catch (SQLException e) {  
            throw e;  
        } finally {  
            close(ps, c);  
        }  
    }  
  
private void close(PreparedStatement ps, Connection c) throws SQLException {  
        if (ps != null) {  
            try {  
                ps.close();  
            } catch (SQLException e) {  
            }  
        }  
        if (c != null) {  
            try {  
                c.close();  
            } catch (SQLException e) {  
            }  
        }  
    }  
}
```

이전 jdbcWithStatementStrategy를 가진 새로운 `JDBCContext`클래스를 만들어냈다.
즉, 반복되는 부분을 `템플릿`으로 만들어 낸 것이다.

그리고 public 메서드인 executeSql()를 추가했는데 이에 주목해보자

앞선 전략패턴의 문제점이었던 구현클래스가 계속 늘어나는 문제를 람다를 사용한 익명내부 클래스 생성로 해결했다. 

또한 varargs를 사용하여 add()처럼 필요한 인자수가 늘어나는 문제를 해결했다. 

그렇다면 UserDao는 어떻게 변했을까? 
```java
private JDBCContext jdbcContext;  // 주입 받는다. 
//
//
public void add(final User user) throws SQLException {  
    jdbcContext.executeSql("insert into users(id, name, password) value(?,?,?)",  
            user.getId(), user.getName(), user.getPassword());  
}

public void delete() throws SQLException {  
    jdbcContext.executeSql("delete from users");  
}
```

이제 UserDao는 DB에 어떻게 연결되고, 예외를 처리하고, 자원을 반환하는지 상관하지 않아도 된다. 
우리가 관심있는 query문만 DB에 Access하는 DAO의 실목적에 맞는 객체가 되었다.

## JDBC Template

이쯤에서 JDBC Template를 사용해서 같은 기능을 만들어 보자

```java
private JdbcTemplate jdbcTemplate;;  // 주입 받는다. 
//
//
public void add(final User user) throws SQLException {  
    jdbcTemplate.update("insert into users(id, name, password) values(?,?,?)",  
            user.getId(), user.getName(), user.getPassword());  
}
```

같은 기능을 하는 JdbcTemplate의 update()메서드다
우리가 위에서 템플릿/콜백 패턴으로 만들어낸 add()기능과 똑같다. 

이쯤에서 해당 update() 메서드의 내부구현을 보자

*JDBC template의 내부 코드를 따라가니 너무 복잡하다면 스킵하고 결론만 봐도 괜찮습니다*

*+저의 부족하고 주관적인 의견으로 보는 과정이므로 틀린 부분이 있을 수 있습니다*

1층
```java 
public int update(String sql, @Nullable Object... args) throws DataAccessException {  
    return this.update(sql, this.newArgPreparedStatementSetter(args));  
}
```
sql문과 이후 파라미터로 varargs를 써서 여러개의 Object를 받고 있다.
일단 sql에 집중해보자

2층
```java
public int update(String sql, @Nullable PreparedStatementSetter pss) throws DataAccessException {  
    return this.update((PreparedStatementCreator)(new SimplePreparedStatementCreator(sql)), (PreparedStatementSetter)pss);  
}
```
쿼리문을 SimplePreparedStatementCreator에 생성자 파라미터로 넘겨주고 이를 PreparedStatementCreator로 형변환을 해주고 있다 

SimplePreparedStatementCreator 
```java
private static class SimplePreparedStatementCreator implements PreparedStatementCreator, SqlProvider {  
    private final String sql;  
    public SimplePreparedStatementCreator(String sql) {  
        Assert.notNull(sql, "SQL must not be null");  
        this.sql = sql;  
    }  
    public PreparedStatement createPreparedStatement(Connection con) throws SQLException {  
        return con.prepareStatement(this.sql);  //여기
    }  
    public String getSql() {  
        return this.sql;  
    }  
}
```
createPreparedStatement()에 주목하면 될 것 같다. 
우리가 계속 보던 prepareStatement()를 return하고 있고,
sql의 not null을 assert하고 sql도 따로 가질 수 있는 wrapper클래스로 이해하면 될 것 같다 

3층
```java
protected int update(final PreparedStatementCreator psc, @Nullable final PreparedStatementSetter pss) throws DataAccessException {  
    this.logger.debug("Executing prepared SQL update");  
    return updateCount((Integer)this.execute(psc, (ps) -> {  
        boolean var9 = false;  
  
        Integer var4;  
        try {  
            var9 = true;  
            if (pss != null) {  
                pss.setValues(ps);  
            }  
  
            int rows = ps.executeUpdate();  
            if (this.logger.isTraceEnabled()) {  
                this.logger.trace("SQL update affected " + rows + " rows");  
            }  
  
            var4 = rows;  
            var9 = false;  
        } finally {  
            if (var9) {  
                if (pss instanceof ParameterDisposer parameterDisposer) {  
                    parameterDisposer.cleanupParameters();  
                }  
  
            }  
        }  
  
        if (pss instanceof ParameterDisposer parameterDisposerx) {  
            parameterDisposerx.cleanupParameters();  
        }  
  
        return var4;  
    }, true));  
}
```
this.execute()에서 쿼리문을 처리하고 있다. 
한층만 더 내려가보자

4층
드디어 도착!
```java
private <T> T execute(PreparedStatementCreator psc, PreparedStatementCallback<T> action, boolean closeResources) throws DataAccessException {  
    //  
    //    
    Connection con = DataSourceUtils.getConnection(this.obtainDataSource());  
    PreparedStatement ps = null;  
    Object var18;
    //   
    //  
    try {  
        ps = psc.createPreparedStatement(con);  
        T result = action.doInPreparedStatement(ps);  
        var18 = result;
    } catch (SQLException var14) {  
        //  
        //
	   } finally {  
       JdbcUtils.closeStatement(ps);  
        DataSourceUtils.releaseConnection(con, this.getDataSource());  
    }  
  
    if (closeResources) {  
        JdbcUtils.closeStatement(ps);  
        DataSourceUtils.releaseConnection(con, this.getDataSource());  
    }  
    //  
    //
    return var18;
```
예외처리에 관련된 부분은 주석처리하고 중요하다 생각되는 부분만 가져왔다. 

내부코드를 보면 Connection을 가져오고, Object 타입인 var18에 쿼리문 실행의 결과를 넣고 있다. 또한 try-catch-finally로 쓴 자원을 반환하고 있다. 그리고 result를 담은 var18을 반환하고 있다.

우리가 만들어진 템플릿/콜백 패턴으로 만들어낸 JDBCContext와 같은 구조를 가지고 있는 것을 확인할 수 있다.

## 결론

순수한 JDBC를 개선하는 과정에서 변경되지 않는 부분을 따로 두고, 변경되는 부분만 추출하는 작업을 해보았다.

그리고 이 과정에서 나온 결과물은 JDBCTemplate의 내부 구조와 아주 유사했다.

즉, JDBC Template라는 것은 순수 JDBC에 디자인패턴(템플릿/콜백)을 적용하여 콜백에 해당하는 부분을 Public API로 드러낸 클래스라고 할 수 있다.

*틀린 부분이나 부족한 부분에 대한 피드백은 언제나 환영합니다*

---


참고

토비의 스프링 3.1 vol 


