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
@CreateUniqueIndex("uni_link", [
  "student_number",
  "hostel_number",
  "bed_number",
])
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
    for (let i = 0; i < 1; i++) {
      const student1 = createStudent(i);
      studentList.push(student1);
      transaction.objectStore("student").add(student1);
    }
  },
});

describe("one item", async () => {
  await indexdbUtil.connect();
  it("find order limit skip exceed", async () => {
    const list = await indexdbUtil.manager.find(Student, {
      limit: 50,
      skip: 1 * 50,
      order: [{ id: "DESC" }],
    });
    expect(list).toEqual([]);
  });
});
