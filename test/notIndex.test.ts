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

const indexdbUtil = new IndexDBUtil({
  name: "school",
  version: 1,
  entityList: [Student],
  versionChange(transaction, currentVersion, goalVersion) {
    for (let i = 0; i < 100; i++) {
      const student1 = new Student();
      student1.id = i;
      student1.name = "name" + i;
      student1.age = i;
      student1.student_number = 2000 + i;
      student1.hostel_number = Math.floor(i / 4);
      student1.bed_numbr = i % 4;
      student1.gender = i % 2;
      student1.iq = i % 3;

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
    const { id, ...item } = studentList[10];
    await indexdbUtil.manager.updateOne(Student, studentList[10], {
      where: studentList[5],
    });
    const res = await indexdbUtil.manager.findOne(Student, {
      where: {
        id: studentList[5].id,
      },
    });
    expect(res).toEqual({
      id: studentList[5].id,
      ...item,
    });
  });

  it("update one query2", async () => {
    await indexdbUtil.manager.updateOne(
      Student,
      { age: 10000 },
      {
        where: {
          id: 50,
        },
      }
    );
    const result = await indexdbUtil.manager.findOne(Student, {
      where: {
        id: 50,
      },
    });
    const { age, ...item } = studentList[50];
    expect(result).toEqual({
      age: 10000,
      ...item,
    });
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
    const { age, ...item } = studentList[51];
    expect(result).toEqual({
      age: 10000,
      ...item,
    });
  });
});
