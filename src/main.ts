import { Column, Entity, IndexDBUtil, PrimaryGeneratedColumn } from "@/lib";

@Entity('a')
class A {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  student_number: number

}

const util = new IndexDBUtil({
  name: "account",
  version: 1,
  entityList: [A],
});

util.connect().then(async (db) => {
  const list = await util.manager.find(A, {
    where: {
      a: "s",
    },
  });
});
