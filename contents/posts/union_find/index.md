---
title: "Union Find"
description: "알고리즘 공부 기록"
date: 2024-01-14
update: 2024-01-14
tags:
  - algorithms
  - union_find
series: "algorithms"
---


Algorithms 강의를 들으며 공부한 기록

## Union Find

두 원소가 같은 집합내에 있는지 확인할때 사용하는 알고리즘이다.
Dynamic connectiviy의 자료구조 중 그래프에 edge가 추가되기만 하는 구조(Incremental connectivity) 에서 사용할 수 있다. 

`union(int p, int q)` 로 p와 q를 같은 집합으로 만들고
`find(int p)`로 p의 루트를 찾거나 `connected(int p, int q)`로 두 요소가 연결되었는가를 확인하는 알고리즘이다. 

```java
public interface UF {  
    void union(int p, int q);  
    boolean connected(int p, int q);  
}
```

## Quick-find

가장 기본적인 방법으로 id array에 각 요소를 매핑하고 `union(int p, int q)`가 호출되면 모든 id array를 loop로 돌며 p의 id와 같은 id를 q의 id로 변경하는 방법이다

```java
public class QuickFindUF implements UF {  
    private int[] id;  
    public QuickFindUF(int N) {  
        id = new int[N];  
        for (int i = 0; i < N; i++) {  
            id[i] = i; // id 배열 매핑
        }  
    } 
    @Override  
    public boolean connected(int p, int q) {  
        return id[p] == id[q];  // id 확인
    }  
    @Override  
    public void union(int p, int q) {  
        int pid = id[p];  
        int qid = id[q];  
        for (int i = 0; i < id.length; i++) {  
            if (id[i] == pid) {  
                id[i] = qid;  
            }  
        }  // p와 id가 같은 모든 id를 q의 id로 바꾼다 
    }  
}
```

- initialize : n
- union : n
- find : n

n개의 요소에 n의 union은 n^2의 시간이 걸린다 

## Quick-Union

id array를 쓰는 것은 비슷하지만 이번에는 i의 부모를 id array에 매핑한다. 즉 `union(int p, int q)`를 호출하면 p의 부모의 id를 q의 부모의 id로 바꾼다. 

```java
public class QuickUnionUF implements UF {  
    private int[] id; 
    public QuickUnionUF(int N) {  
        id = new int[N];  
        for (int i = 0; i < N; i++) {  
            id[i] = i;  
        }  
    }  
    private int root(int i) {        
        while (i != id[i]) {  
            i = id[i];  
        }  
        return i;  // 부모 루트를 최상단까지 찾는다 
    }  
    @Override  
    public void union(int p, int q) {        
        int i = root(p);  
        int j = root(q);  
        id[i] = j;  //p의 루트를 q의 루트로 바꾼다
    }   
    @Override  
    public boolean connected(int p, int q) {  
        return root(p) == root(q);  
    }  
}
```
- initialize : n
- union : n (root 찾는 비용 포함)
- find : n

Quick-Find 보다 더 빠른 실행을 보이는 케이스도 있지만 알고리즘은 항상 최악의 경우를 상정해야 하므로 트리구조가 엄청나게 길거나 길이가 N이 될때 Quick-Find와 비슷하게 n^2의 실행시간을 가지게 된다

## Quick Union 개선하기 

### Weighting

현재 Quick Union은 트리의 크기와 상관없이 무조건 p를 q의 루트에 갖다 
붙이기 때문에 트리의 길이가 엄청나게 길어지는 문제점을 가지고 있다. 

하지만 union을 실행할때 트리의 사이즈를 비교하고 작은 트리를 보다 큰 트리에 연결하면 트리의 깊이를 짧게 유지할 수 있다

```java
public class QuickUnionUF implements UF {  
    private int[] id; 
    public QuickUnionUF(int N) {  
        id = new int[N];  
        for (int i = 0; i < N; i++) {  
            id[i] = i;
            sizes[i] = i; // size도 같이 매핑한다
        }  
    }  
    private int root(int i) {        
        while (i != id[i]) {  
            i = id[i];  
        }  
        return i;
    }  
    @Override  
    public void union(int p, int q) {        
        int i = root(p);  
        int j = root(q);  
        if (i == j) {
	        return; //루트가 같으면 early return
        }
        if (size[i] < size[j]) {
	        id[i] = j;
	        size[j] += size[i]; 
        }
        else {
	        id[j] = i;
	        size[i] += size[j]; //사이즈 비교 후 작은 트리를 큰 트리에 병합한다
        }
    }   
    @Override  
    public boolean connected(int p, int q) {  
        return root(p) == root(q);  
    }  
}
```

- initialize : n
- union : lg n(root 찾기 까지 포함)
- find : lg n

`왜 lg n의 비용으로 줄어들었을까?` 

T1의 크기가 3이고  T2의 크기가 5일때 T1에 있는 a를 T2에 있는 b에 연결시킨다고 가정해보자. 

이때 T1은 T2에 병합되고 a의 깊이는 1이 증가하게 된다. union을 호출할때 a의 깊이는 1이 증가하는데에 비해 a가 속한 트리의 크기는 3에서 8로 최소 2배이상이 증가하게 된다.

이를 계속 실행하면 

| a의 깊이 | 0 | 1 | 2 | 3 | ... | lg N |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| a가 속한 트리의 크기 | 1 | 2 | 4 | 8 |  | N |

이 되기 때문에 find의 비용이 절감하게 된다

### Path-Compressing

위의 알고리즘을 Path-Compressing으로 더 개선할 수 있다   

현재는 `root()`를 while문으로 모든 깊이의 노드를 반복하여 검색하고 있다.

이 때 이 기능이 호출될때마다 각 호출된 노드의 id를 루트의 id로 바꿔주는 작업을 하면 트리의 깊이를 더 평탄하게 바꾸어 줄 수 있다.

위의 코드의 root를 
```java
    private int root(int i) {        
        while (i != id[i]) {  
	        id[i] = id[id[i]] // i의 루트를 부모 루트로!
            i = id[i];  
        }  
        return i;
    }  
```
이렇게 바꿔주기만 해도 트리의 깊이가 계속 평탄화 되면서 root를 호출하는 모든 기능의 비용이 절감된다. 



참고
https://www.coursera.org/learn/algorithms-part1