import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  Entity,
  IndexDBUtil,
  Column,
  PrimaryGeneratedColumn,
  CreateUniqueIndex,
  MoreThen,
  LessThen,
  Equal,
} from "@/lib";

@Entity("student")
// @CreateUniqueIndex("uni_link", [
//   "student_number",
//   "hostel_number",
//   "bed_number",
// ])
export class Student {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  age!: number;

  @Column()
  student_number!: number;

  @Column()
  hostel_number!: number;

  @Column()
  bed_numbr!: number;

  @Column()
  gender!: number;

  @Column()
  iq!: number;
}

const studentList: Student[] = [];

function createStudent(i: number) {
  const student1 = new Student();
  student1.id = i;
  student1.name = "name" + i;
  student1.age = i;
  student1.student_number = 2000 + i;
  student1.hostel_number = Math.floor(i / 4);
  student1.bed_numbr = i % 4;
  student1.gender = i % 2;
  student1.iq = i % 3;
  return student1;
}

const indexdbUtil = new IndexDBUtil({
  name: "school",
  version: 1,
  entityList: [Student],
  versionChange(transaction, currentVersion, goalVersion) {
    for (let i = 0; i < 100; i++) {
      const student1 = createStudent(i);
      studentList.push(student1);
      transaction.objectStore("student").add(student1);
    }
  },
});

// The two tests marked with concurrent will be run in parallel
describe("not has index", async () => {
  await indexdbUtil.connect();

  it("findOne", async () => {
    const student = await indexdbUtil.manager.findOne(Student, {
      where: {
        age: 50,
      },
    });
    expect(student).toEqual(studentList.find((item) => item.age === 50));

    const student1 = await indexdbUtil.manager.findOne(Student, {
      where: {
        age: MoreThen(12),
      },
    });
    expect(student1).toEqual(studentList.find((item) => item.age > 12));

    // 查询不存在
    const student2 = await indexdbUtil.manager.findOne(Student, {
      where: {
        age: MoreThen(100),
      },
    });
    expect(student2).toEqual(
      studentList.find((item) => item.age > 100) || null
    );
  });

  it("find all", async () => {
    const list = await indexdbUtil.manager.find(Student);
    expect(list).toEqual(studentList);

    const list1 = await indexdbUtil.manager.find(Student, {});
    expect(list1).toEqual(studentList);

    const list2 = await indexdbUtil.manager.find(Student, {
      where: {},
    });
    expect(list2).toEqual(studentList);
  });

  it("find query", async () => {
    const list = await indexdbUtil.manager.find(Student, {
      where: {
        gender: 0,
      },
    });
    expect(list).toEqual(studentList.filter((item) => item.gender === 0));

    const list1 = await indexdbUtil.manager.find(Student, {
      where: {
        gender: 0,
        iq: 2,
      },
    });
    expect(list1).toEqual(
      studentList.filter((item) => item.gender === 0 && item.iq === 2)
    );

    // 查询不存在
    const list2 = await indexdbUtil.manager.find(Student, {
      where: {
        gender: 1000,
        iq: 2,
      },
    });
    expect(list2).toEqual(
      studentList.filter((item) => item.gender === 1000 && item.iq === 2)
    );
  });

  it("find compare", async () => {
    const list = await indexdbUtil.manager.find(Student, {
      where: {
        age: MoreThen(50),
        gender: MoreThen(0),
        iq: LessThen(1),
      },
    });
    expect(list).toEqual(
      studentList.filter(
        (item) => item.age > 50 && item.gender > 0 && item.iq < 1
      )
    );

    const list1 = await indexdbUtil.manager.find(Student, {
      where: {
        age: MoreThen(Equal(50)),
        gender: MoreThen(0),
        iq: LessThen(Equal(1)),
      },
    });
    expect(list1).toEqual(
      studentList.filter(
        (item) => item.age >= 50 && item.gender > 0 && item.iq <= 1
      )
    );

    // 查询不存在
    const list2 = await indexdbUtil.manager.find(Student, {
      where: {
        age: MoreThen(100),
        gender: MoreThen(0),
        iq: LessThen(1),
      },
    });
    expect(list2).toEqual(
      studentList.filter(
        (item) => item.age >= 100 && item.gender > 0 && item.iq <= 1
      )
    );
  });

  it("update one query", async () => {
    await indexdbUtil.manager.updateOne(Student, studentList[10], {
      where: studentList[5],
    });
    Object.keys(studentList[10]).forEach((key) => {
      if (key !== "id") {
        Reflect.set(studentList[5], key, Reflect.get(studentList[10], key));
      }
    });
    const res = await indexdbUtil.manager.findOne(Student, {
      where: {
        id: studentList[5].id,
      },
    });

    expect(res).toEqual(studentList.find((i) => i.id === 5));
  });

  it("update one query2", async () => {
    await indexdbUtil.manager.updateOne(Student, createStudent(10000), {
      where: {
        id: 50,
      },
    });
    const result = await indexdbUtil.manager.findOne(Student, {
      where: {
        id: 50,
      },
    });
    const index = studentList.findIndex((i) => i.id === 50);
    Object.keys(createStudent(10000)).forEach((key) => {
      if (key !== "id") {
        Reflect.set(
          studentList[index],
          key,
          Reflect.get(createStudent(10000), key)
        );
      }
    });
    expect(result).toEqual(studentList[index]);
  });

  it("update one compare", async () => {
    await indexdbUtil.manager.updateOne(
      Student,
      { age: 10000 },
      {
        where: {
          id: MoreThen(50),
        },
      }
    );
    const result = await indexdbUtil.manager.findOne(Student, {
      where: {
        id: 51,
      },
    });

    const item = studentList.find((i) => i.id > 50);
    item!.age = 10000;

    expect(result).toEqual(item);
  });

  it("update query", async () => {
    await indexdbUtil.manager.update(
      Student,
      { age: 10024 },
      {
        where: {
          gender: 0,
          bed_numbr: 2,
        },
      }
    );
    const deleteGoal = studentList.filter(
      (i) => i.gender === 0 && i.bed_numbr === 2
    );
    deleteGoal.forEach((i) => (i.age = 10024));

    const list = await indexdbUtil.manager.find(Student);
    expect(list).toEqual(studentList);
  });

  it("delete one query", async () => {
    await indexdbUtil.manager.deleteOne(Student, {
      where: {
        id: 50,
      },
    });
    studentList.splice(
      studentList.findIndex((i) => i.id === 50),
      1
    );
    const list = await indexdbUtil.manager.find(Student);
    expect(list.length).toBe(99);
    expect(list.findIndex((i) => i.id === 50)).toBe(-1);
  });

  it("delete one compare", async () => {
    await indexdbUtil.manager.deleteOne(Student, {
      where: {
        id: LessThen(100),
      },
    });
    studentList.splice(
      studentList.findIndex((i) => i.id < 100),
      1
    );
    const list = await indexdbUtil.manager.find(Student);
    expect(list.length).toBe(98);
    expect(list.findIndex((i) => i.id === 0)).toBe(-1);
  });

  it("delete query", async () => {
    await indexdbUtil.manager.delete(Student, {
      where: {
        gender: 0,
        bed_numbr: 2,
      },
    });
    const deleteGoal = studentList.filter(
      (i) => i.gender === 0 && i.bed_numbr === 2
    );
    deleteGoal.forEach((i) =>
      studentList.splice(
        studentList.findIndex((i1) => i.id === i1.id),
        1
      )
    );

    const list = await indexdbUtil.manager.find(Student);
    expect(list).toEqual(studentList);
  });

  it("insert one", async () => {
    await indexdbUtil.manager.insertOne(Student, createStudent(1000));
    const item = await indexdbUtil.manager.findOne(Student, {
      where: {
        age: 1000,
      },
    });
    studentList.push(createStudent(1000));
    expect(item).toEqual(createStudent(1000));
  });

  it("insert", async () => {
    await indexdbUtil.manager.insert(
      Student,
      [1001, 1002, 1003, 1004].map((i) => createStudent(i))
    );
    studentList.push(...[1001, 1002, 1003, 1004].map((i) => createStudent(i)));
    const list = await indexdbUtil.manager.find(Student, {
      where: {
        age: MoreThen(1000),
      },
    });
    expect(list).toEqual(studentList.filter((i) => i.age > 1000));
  });
});
