import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Title
} from "@mantine/core";
import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";
import {
  Accommodation,
  useDeleteAccommodationMutation,
  useGetAccommodationsQuery,
  useUpsertAccommodationMutation
} from "@store/grader/grader.logic.api";
import { useMemo, useState } from "react";

import { StudentMultiSelect } from "@/components/routes/Grader/components/StudentMultiSelect";
import { notify } from "@/components/ui/notify";

import styles from "./Accommodations.module.css";

const formatSetting = (value: number | null | undefined, suffix: string) =>
  value == null ? "—" : `${value}${suffix}`;

export const Accommodations = () => {
  const [selectedSids, setSelectedSids] = useState<string[]>([]);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [extraDays, setExtraDays] = useState<number | null>(0);
  const [timeMultiplier, setTimeMultiplier] = useState<number | null>(1);
  const [visible, setVisible] = useState(false);
  const [allowLink, setAllowLink] = useState(false);

  const { data: assignments = [], isLoading: assignmentsLoading } = useGetAssignmentsQuery();
  const {
    data: accommodationsData,
    isLoading: accommodationsLoading,
    isError: accommodationsError
  } = useGetAccommodationsQuery();
  const [upsertAccommodation, { isLoading: isSaving }] = useUpsertAccommodationMutation();
  const [deleteAccommodation, { isLoading: isDeleting }] = useDeleteAccommodationMutation();

  const assignmentOptions = useMemo(
    () => assignments.map(({ id, name }) => ({ value: String(id), label: name })),
    [assignments]
  );
  const accommodations = accommodationsData?.accommodations ?? [];

  const handleSave = async () => {
    if (selectedSids.length === 0) return;

    try {
      await upsertAccommodation({
        sids: selectedSids,
        assignment_id: assignmentId == null ? null : Number(assignmentId),
        duedate: extraDays,
        time_limit: timeMultiplier,
        visible,
        allowLink
      }).unwrap();
      setSelectedSids([]);
      notify.success("Accommodation saved");
    } catch {
      notify.error("Couldn't save the accommodation. Try again.");
    }
  };

  const handleDelete = async (accommodation: Accommodation) => {
    try {
      await deleteAccommodation(accommodation.row_id).unwrap();
      notify.success("Accommodation deleted");
    } catch {
      notify.error("Couldn't delete the accommodation. Try again.");
    }
  };

  return (
    <section className={styles.page} aria-labelledby="accommodations-heading">
      <header>
        <Title id="accommodations-heading" order={1} className={styles.heading}>
          Manage accommodations
        </Title>
        <Text className={styles.intro}>
          Give selected students extra time, a deadline extension, or access to a hidden assignment.
        </Text>
      </header>

      <Paper withBorder p="lg">
        <div className={styles.formGrid}>
          <StudentMultiSelect
            selected={selectedSids}
            onChange={setSelectedSids}
            label="Students"
            height={260}
          />
          <div className={styles.settings}>
            <Select
              label="Assignment"
              description="Leave blank to apply to every assignment."
              placeholder="All assignments"
              data={assignmentOptions}
              value={assignmentId}
              onChange={setAssignmentId}
              searchable
              clearable
              disabled={assignmentsLoading}
            />
            <div className={styles.numberFields}>
              <NumberInput
                label="Extend deadline by (days)"
                value={extraDays ?? ""}
                onChange={(value) => setExtraDays(typeof value === "number" ? value : null)}
                min={0}
                allowDecimal={false}
              />
              <NumberInput
                label="Time-limit multiplier"
                value={timeMultiplier ?? ""}
                onChange={(value) => setTimeMultiplier(typeof value === "number" ? value : null)}
                min={0}
                step={0.5}
                decimalScale={2}
              />
            </div>
            <Group gap="lg">
              <Checkbox
                checked={visible}
                onChange={(event) => setVisible(event.currentTarget.checked)}
                label="Make visible"
              />
              <Checkbox
                checked={allowLink}
                onChange={(event) => setAllowLink(event.currentTarget.checked)}
                label="Allow direct link"
              />
            </Group>
            <Button onClick={handleSave} loading={isSaving} disabled={selectedSids.length === 0}>
              Save accommodation
            </Button>
          </div>
        </div>
      </Paper>

      <div>
        <Title order={2}>Current accommodations</Title>
        {accommodationsError ? (
          <Alert color="red" mt="md">
            Couldn't load accommodations. Refresh the page to try again.
          </Alert>
        ) : accommodationsLoading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
          </Group>
        ) : accommodations.length === 0 ? (
          <Paper withBorder mt="md" className={styles.empty}>
            No accommodations have been configured.
          </Paper>
        ) : (
          <Paper withBorder mt="md" className={styles.tableWrap}>
            <Table highlightOnHover verticalSpacing="sm" aria-label="Current accommodations">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Student</Table.Th>
                  <Table.Th>Assignment</Table.Th>
                  <Table.Th>Extra days</Table.Th>
                  <Table.Th>Time multiplier</Table.Th>
                  <Table.Th>Visible</Table.Th>
                  <Table.Th>Direct link</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accommodations.map((accommodation) => (
                  <Table.Tr key={accommodation.row_id}>
                    <Table.Td>{accommodation.sid}</Table.Td>
                    <Table.Td>
                      {accommodation.assignment_id == null
                        ? "All assignments"
                        : accommodation.assignment_id}
                    </Table.Td>
                    <Table.Td>{formatSetting(accommodation.duedate, "")}</Table.Td>
                    <Table.Td>{formatSetting(accommodation.time_limit, "×")}</Table.Td>
                    <Table.Td>{accommodation.visible ? "Yes" : "No"}</Table.Td>
                    <Table.Td>{accommodation.allowLink ? "Yes" : "No"}</Table.Td>
                    <Table.Td>
                      <Button
                        color="red"
                        variant="subtle"
                        size="xs"
                        loading={isDeleting}
                        onClick={() => handleDelete(accommodation)}
                        aria-label={`Delete accommodation for ${accommodation.sid}`}
                      >
                        Delete
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </div>
    </section>
  );
};

export default Accommodations;
