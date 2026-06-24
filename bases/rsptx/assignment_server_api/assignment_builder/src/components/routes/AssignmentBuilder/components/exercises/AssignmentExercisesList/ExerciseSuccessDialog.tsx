import { Icon } from "@components/ui/Icon";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";

interface ExerciseSuccessDialogProps {
  showSuccessDialog: boolean;
  setShowSuccessDialog: (show: boolean) => void;
  handleCreateAnother: () => void;
  handleFinishCreating: () => void;
  lastExerciseType: string;
}

export const ExerciseSuccessDialog = ({
  showSuccessDialog,
  setShowSuccessDialog,
  handleCreateAnother,
  handleFinishCreating,
  lastExerciseType
}: ExerciseSuccessDialogProps) => {
  return (
    <Modal
      opened={showSuccessDialog}
      onClose={() => setShowSuccessDialog(false)}
      title="Exercise saved"
      size={450}
      withCloseButton={false}
      centered
    >
      <Stack align="center" ta="center" gap="md" py="md">
        <Icon name="check-circle" size={48} color="var(--rs-success)" />
        <Text size="lg" fw={500}>
          Your {lastExerciseType} exercise is saved.
        </Text>
        <Text>Create another exercise?</Text>
        <Group justify="space-between" gap="sm" w="100%">
          <Button leftSection={<Icon name="plus" />} onClick={handleCreateAnother}>
            Create another
          </Button>
          <Button leftSection={<Icon name="list" />} onClick={handleFinishCreating}>
            Back to exercises
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
