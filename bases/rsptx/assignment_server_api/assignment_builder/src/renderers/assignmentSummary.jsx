import { Table } from "@mantine/core";
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
      max: 100
    },
    {
      key: 2,
      id: 2,
      title: "Question 2",
      points: 100,
      due: "2021-09-01",
      average: 75.5,
      min: 0,
      max: 100
    },
    {
      key: 3,
      id: 3,
      title: "Question 3",
      points: 100,
      due: "2021-09-01",
      average: 75.5,
      min: 0,
      max: 100
    }
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
    { key: 3, sid: "jdown", response: "C", points: 75 }
  ];

  const isSelected = (row) => selectedRow && selectedRow.id === row.id;

  return (
    <div>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>title</Table.Th>
            <Table.Th>points</Table.Th>
            <Table.Th>due</Table.Th>
            <Table.Th>average</Table.Th>
            <Table.Th>min</Table.Th>
            <Table.Th>max</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(Array.isArray(assignData) ? assignData : []).map((row) => (
            <Table.Tr
              key={row.id}
              bg={isSelected(row) ? "var(--mantine-color-blue-light)" : undefined}
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSelectedRow(row);
                setQuestionData(data2);
              }}
            >
              <Table.Td>{row.title}</Table.Td>
              <Table.Td>{row.points}</Table.Td>
              <Table.Td>{row.due}</Table.Td>
              <Table.Td>{row.average}</Table.Td>
              <Table.Td>{row.min}</Table.Td>
              <Table.Td>{row.max}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <p>Preview of Question goes here (maybe)</p>

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Student</Table.Th>
            <Table.Th>Response</Table.Th>
            <Table.Th>Points</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(questionData || []).map((row) => (
            <Table.Tr
              key={row.key}
              bg={isSelected(row) ? "var(--mantine-color-blue-light)" : undefined}
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedRow(row)}
            >
              <Table.Td>{row.sid}</Table.Td>
              <Table.Td>{row.response}</Table.Td>
              <Table.Td>{row.points}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
