import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  Entity,
  IndexDBUtil,
  Column,
  PrimaryGeneratedColumn,
  CreateUniqueIndex,
  MoreThen,
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
}

const indexdbUtil = new IndexDBUtil({
  name: "school",
  version: 1,
  entityList: [Student],
  versionChange(transaction, currentVersion, goalVersion) {
    let hn = 0;
    for (let i = 0; i < 100; i++) {
      const student1 = new Student();
      student1.name = "name" + i;
      student1.age = i;
      student1.student_number = 2000 + i;
      if (i % 4 === 0) {
        hn++;
      }
      student1.hostel_number = hn;
      student1.bed_numbr = i % 4;
      transaction.objectStore("student").add(student1);
    }
  },
});

// The two tests marked with concurrent will be run in parallel
describe("suite", async () => {
  await indexdbUtil.connect();

  it("findOne", async () => {
    const student = await indexdbUtil.manager.findOne(Student, {
      where: {
        age: 50,
      },
    });
    expect(student).toEqual({
      id: 51,
      name: "name50",
      age: 50,
      student_number: 2050,
      hostel_number: 13,
      bed_numbr: 2,
    });

    const student1 = await indexdbUtil.manager.findOne(Student, {
      where: {
        age: MoreThen(12),
      },
    });
    expect(student1).toEqual({
      id: 14,
      name: "name50",
      age: 13,
      student_number: 2013,
      hostel_number: 3,
      bed_numbr: 1,
    });
  });
});
