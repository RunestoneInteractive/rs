import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import React, { useEffect } from "react";
import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

export function AssignmentSummary() {
  const dispatch = useDispatch();

  const data = [
    {
      key: 1,
      id: 1,
      title: "Question 1",
      points: 100,
      due: "2021-09-01",
      average: 75.5,
      min: 0,
      max: 100,
    },
    {
      key: 2,
      id: 2,
      title: "Question 2",
      points: 100,
      due: "2021-09-01",
      average: 75.5,
      min: 0,
      max: 100,
    },
    {
      key: 3,
      id: 3,
      title: "Question 3",
      points: 100,
      due: "2021-09-01",
      average: 75.5,
      min: 0,
      max: 100,
    },
  ];
  const [assignData, setAssignData] = useState([data]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [questionData, setQuestionData] = useState(null);

  useEffect(() => {
    setAssignData(data);
  }, []);

  const data2 = [
    { key: 1, sid: "bmiller", response: "A", points: 100 },
    { key: 2, sid: "jdoe", response: "B", points: 50 },
    { key: 3, sid: "jdown", response: "C", points: 75 },
  ];

  return (
    <div>
      <DataTable
        value={assignData}
        paginator
        rows={10}
        selectionMode="single"
        selection={selectedRow}
        onSelectionChange={(e) => {
          setSelectedRow(e.value);
          setQuestionData(data2);
        }}
        dataKey="id"
      >
        <Column key="title" field="title" header="title" />
        <Column field="points" header="points" />
        <Column field="due" header="due" />
        <Column field="average" header="average" />
        <Column field="min" header="min" />
        <Column field="max" header="max" />
      </DataTable>

      <p>Preview of Question goes here (maybe)</p>

      <DataTable
        value={questionData}
        paginator
        rows={10}
        selectionMode="single"
        selection={selectedRow}
        onSelectionChange={(e) => setSelectedRow(e.value)}
        dataKey="id"
      >
        <Column key="1" field="sid" header="Student" />
        <Column key="2" field="response" header="Response" />
        <Column key="3" field="points" header="Points" />
      </DataTable>
    </div>
  );
}
