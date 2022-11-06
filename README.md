# indexdb-util (beta，就是个玩具！！！)

使用类似 TypeOrm 的 manager api 的方法操作 indexdb

只能 TypeScript 使用，TypeScript 需要开启装饰器（原生 js 我也不知道怎么用，哈哈哈哈 😂）

需要配合`vite`，`webpack`等使用。

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

## Install

```bash
# npm
npm i indexdb-util
# pnpm
pnpm add indexdb-util
```

## Usage

声明一个 ObjectStore。

```ts
// student表示一个objectStore
@Entity("student")
// 普通索引
@CreateIndex("idx_name", "name")
// 唯一索引
@CreateUniqueIndex("uni_stdent_number", "student_number")
// 联合索引
@CreateIndex("idx_name_student_number", ["name", "student_number"])
export class Student {
  // @PrimaryGeneratedColumn() 表示id是主键。
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  student_number!: number;

  @Column()
  age!: number;
}
```

初始化 indexdb

```ts
const indexdbUtil = new IndexDBUtil({
  // indexdb 名称
  name: "school",
  // indexdb 版本
  version: 1,
  // 声明的objectStore
  entityList: [Student],
  // 当版本更改时会触发，可以做一些数据迁移的操作。
  versionChange(transaction, currentVersion, goalVersion) {},
});

indexdbUtil.connect().then(() = {
    // ... 可以开始操作
})
```

> 可以参考测试文件`test/*`。

## Api

```ts
indexdbUtil.manager;

interface ManagerOptions<T> {
  // 类型推断
  where?: { [K in keyof T]?: T[K] | CompareItem | CompareItem[] };
  limit?: number;
  skip?: number;
  order?: Array<{ [K in keyof T]?: "DESC" | "ASC" }>;
}

interface Manager {
  findOne<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<InstanceType<T> | null>;
  find<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<Array<InstanceType<T>>>;
  insertOne<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>
  ): Promise<IDBValidKey>;
  insert<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>[]
  ): Promise<IDBValidKey>;
  updateOne<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
  update<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
  deleteOne<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
  delete<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
}
```
