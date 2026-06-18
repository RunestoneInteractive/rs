import {
  ActionIcon,
  Button,
  Center,
  FileButton,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { FC, useCallback, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import {
  useCreateDatafileMutation,
  useDeleteDatafileMutation,
  useFetchDatafileQuery,
  useFetchDatafilesQuery,
  useUpdateDatafileMutation
} from "@/store/datafile/datafile.logic.api";
import { DataFile, ExistingDataFile, SelectedDataFile } from "@/types/datafile";
import { notify } from "@components/ui/notify";

import styles from "./DataFilesEditor.module.css";

const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".csv",
  ".py",
  ".jar",
  ".js",
  ".ts",
  ".html",
  ".css",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".sql",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg"
];

const UPLOAD_ACCEPT = "text/*,image/*,.txt,.csv,.json,.py,.js,.html,.css";

const hasValidExtension = (filename: string): boolean => {
  if (!filename) return false;
  const lowerFilename = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lowerFilename.endsWith(ext));
};

const validateFilename = (filename: string): { isValid: boolean; error: string } => {
  if (!filename.trim()) {
    return { isValid: false, error: "Filename is required" };
  }

  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(filename)) {
    return { isValid: false, error: "Filename contains invalid characters" };
  }

  if (!hasValidExtension(filename)) {
    return {
      isValid: false,
      error: `Filename must have a valid extension: ${SUPPORTED_EXTENSIONS.join(", ")}`
    };
  }

  return { isValid: true, error: "" };
};

interface DataFilesEditorProps {
  selectedDataFiles: SelectedDataFile[];
  onSelectedDataFilesChange: (files: SelectedDataFile[]) => void;
}

const initialNewDataFile: DataFile = {
  filename: "",
  content: "",
  isImage: false,
  rows: 10,
  cols: 60,
  isEditable: true
};

const imageSource = (content: string): string =>
  content.startsWith("data:") ? content : `data:image/png;base64,${content}`;

export const DataFilesEditor: FC<DataFilesEditorProps> = ({
  selectedDataFiles,
  onSelectedDataFilesChange
}) => {
  const { data: existingDatafiles = [], isLoading } = useFetchDatafilesQuery();
  const [createDatafile, { isLoading: isCreating }] = useCreateDatafileMutation();
  const [updateDatafile, { isLoading: isUpdating }] = useUpdateDatafileMutation();
  const [deleteDatafile, { isLoading: isDeleting }] = useDeleteDatafileMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAcid, setEditingAcid] = useState<string | null>(null);
  const [editDataFile, setEditDataFile] = useState<DataFile>(initialNewDataFile);
  const [newDataFile, setNewDataFile] = useState<DataFile>(initialNewDataFile);
  const [filenameError, setFilenameError] = useState<string>("");
  const resetCreateUpload = useRef<() => void>(null);
  const resetEditUpload = useRef<() => void>(null);

  const { data: editingDatafileData, isFetching: isFetchingEditData } = useFetchDatafileQuery(
    editingAcid || "",
    { skip: !editingAcid }
  );

  const handleOpenModal = () => {
    setNewDataFile(initialNewDataFile);
    setFilenameError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setNewDataFile(initialNewDataFile);
    setFilenameError("");
    setIsModalOpen(false);
    resetCreateUpload.current?.();
  };

  const handleUpdateNewDataFile = (field: keyof DataFile, value: DataFile[keyof DataFile]) => {
    setNewDataFile((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = useCallback((file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    const isImage = file.type.startsWith("image/");

    reader.onload = (e) => {
      const content = e.target?.result as string;
      setNewDataFile((prev) => ({
        ...prev,
        filename: file.name,
        content,
        isImage,
        isEditable: !isImage
      }));
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }

    resetCreateUpload.current?.();
  }, []);

  const handleCreateDataFile = async () => {
    const validation = validateFilename(newDataFile.filename);
    if (!validation.isValid) {
      setFilenameError(validation.error);
      return;
    }
    setFilenameError("");

    let contentToSave = newDataFile.content;
    if (newDataFile.isImage && contentToSave.startsWith("data:")) {
      const base64Index = contentToSave.indexOf(";base64,");
      if (base64Index !== -1) {
        contentToSave = contentToSave.substring(base64Index + 8);
      }
    }

    try {
      const response = await createDatafile({
        filename: newDataFile.filename,
        main_code: contentToSave
      }).unwrap();

      const acid = response.acid;

      onSelectedDataFilesChange([...selectedDataFiles, acid]);

      handleCloseModal();
    } catch (error) {
      console.error("Failed to create datafile:", error);
    }
  };

  const handleOpenEditModal = (acid: string) => {
    setEditingAcid(acid);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditingAcid(null);
    setEditDataFile(initialNewDataFile);
    setIsEditModalOpen(false);
    resetEditUpload.current?.();
  };

  const handleEditDataLoaded = useCallback(() => {
    if (editingDatafileData) {
      const isImage = editingDatafileData.filename?.match(/\.(png|jpg|jpeg|gif|svg)$/i) !== null;
      setEditDataFile({
        filename: editingDatafileData.filename || "",
        content: editingDatafileData.main_code || "",
        isImage,
        rows: 10,
        cols: 60,
        isEditable: !isImage
      });
    }
  }, [editingDatafileData]);

  if (editingDatafileData && isEditModalOpen && editDataFile.filename === "") {
    handleEditDataLoaded();
  }

  const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return "";
    return filename.substring(lastDot).toLowerCase();
  };

  const handleEditFileUpload = useCallback(
    (file: File | null) => {
      if (!file) return;

      const originalExtension = getFileExtension(editDataFile.filename);
      const uploadedExtension = getFileExtension(file.name);

      if (originalExtension !== uploadedExtension) {
        notify.error(
          `File extension mismatch. Expected "${originalExtension}" but got "${uploadedExtension}". Upload a file with the same extension.`
        );
        resetEditUpload.current?.();
        return;
      }

      const reader = new FileReader();
      const isImage = file.type.startsWith("image/");

      reader.onload = (e) => {
        const content = e.target?.result as string;

        setEditDataFile((prev) => ({
          ...prev,
          content,
          isImage,
          isEditable: !isImage
        }));
      };

      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }

      resetEditUpload.current?.();
    },
    [editDataFile.filename]
  );

  const handleSaveEditDataFile = async () => {
    if (!editingAcid) return;

    let contentToSave = editDataFile.content;
    if (editDataFile.isImage && contentToSave.startsWith("data:")) {
      const base64Index = contentToSave.indexOf(";base64,");
      if (base64Index !== -1) {
        contentToSave = contentToSave.substring(base64Index + 8);
      }
    }

    try {
      await updateDatafile({
        acid: editingAcid,
        main_code: contentToSave
      }).unwrap();

      handleCloseEditModal();
    } catch (error) {
      console.error("Failed to update datafile:", error);
    }
  };

  const handleDeleteDatafile = (acid: string, filename: string) => {
    modals.openConfirmModal({
      title: "Delete data file",
      children: <Text size="sm">Delete &quot;{filename}&quot;? This can&apos;t be undone.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await deleteDatafile(acid).unwrap();

          onSelectedDataFilesChange(selectedDataFiles.filter((fileAcid) => fileAcid !== acid));
        } catch (error) {
          console.error("Failed to delete datafile:", error);
        }
      }
    });
  };

  const existingDatafilesOptions = existingDatafiles
    .filter((df: ExistingDataFile) => hasValidExtension(df.filename))
    .map((df: ExistingDataFile) => ({
      label: df.filename || df.acid,
      value: df.acid
    }));

  return (
    <div className={styles.dataFilesEditor}>
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <div className={styles.grow}>
          {isLoading ? (
            <Group gap="sm" p="sm">
              <Loader size="sm" />
              <span>Loading data files…</span>
            </Group>
          ) : (
            <MultiSelect
              id="data-files"
              value={selectedDataFiles}
              data={existingDatafilesOptions}
              onChange={onSelectedDataFilesChange}
              placeholder="Select data files to include"
              searchable
              clearable
              nothingFoundMessage="No matching data files"
            />
          )}
        </div>
        <Button
          variant="outline"
          leftSection={<Icon name="plus" size={14} />}
          onClick={handleOpenModal}
        >
          Create data file
        </Button>
      </Group>

      {selectedDataFiles.length > 0 && (
        <div className={styles.selectedList}>
          <h5 className={styles.selectedTitle}>Selected files ({selectedDataFiles.length})</h5>
          <Stack gap="xs">
            {selectedDataFiles.map((selectedFileAcid) => {
              const file = existingDatafiles.find((df) => df.acid === selectedFileAcid);
              const isOwner = file?.owner !== null;
              return (
                <Group
                  key={selectedFileAcid}
                  justify="space-between"
                  className={styles.selectedRow}
                >
                  <Group gap="xs">
                    <span className={styles.fileName}>{file?.filename || selectedFileAcid}</span>
                    {file?.owner && <span className={styles.fileOwner}>by {file.owner}</span>}
                  </Group>
                  {isOwner && (
                    <Group gap="xs">
                      <Tooltip label="Edit data file" position="top">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label="Edit data file"
                          onClick={() => handleOpenEditModal(selectedFileAcid)}
                          disabled={isUpdating || isDeleting}
                        >
                          <Icon name="pencil" size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete data file" position="top">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Delete data file"
                          onClick={() =>
                            handleDeleteDatafile(
                              selectedFileAcid,
                              file?.filename || selectedFileAcid
                            )
                          }
                          disabled={isUpdating || isDeleting}
                        >
                          <Icon name="trash" size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                </Group>
              );
            })}
          </Stack>
        </div>
      )}

      <Modal
        title="Create data file"
        opened={isModalOpen}
        onClose={handleCloseModal}
        size="lg"
        closeOnEscape={!isCreating}
        closeOnClickOutside={!isCreating}
        withCloseButton={!isCreating}
        centered
      >
        <Stack gap="md">
          <Group gap="sm">
            <FileButton
              resetRef={resetCreateUpload}
              accept={UPLOAD_ACCEPT}
              onChange={handleFileUpload}
            >
              {(props) => (
                <Button
                  {...props}
                  variant="outline"
                  leftSection={<Icon name="download" size={14} />}
                >
                  Upload file
                </Button>
              )}
            </FileButton>
            <Text size="sm" c="dimmed">
              Or fill in the form manually below
            </Text>
          </Group>

          <TextInput
            id="new-filename"
            label="Filename"
            withAsterisk
            value={newDataFile.filename}
            error={filenameError || undefined}
            onChange={(e) => {
              handleUpdateNewDataFile("filename", e.target.value);
              if (filenameError) setFilenameError("");
            }}
            placeholder="e.g., data.txt or image.png"
          />

          {newDataFile.isImage ? (
            <div>
              <Text size="sm" fw={500} mb={6}>
                Image preview
              </Text>
              {newDataFile.content ? (
                <img
                  src={newDataFile.content}
                  alt={newDataFile.filename}
                  className={styles.imagePreview}
                />
              ) : (
                <Text c="dimmed">No image loaded</Text>
              )}
            </div>
          ) : (
            <Textarea
              id="new-content"
              label="File content"
              value={newDataFile.content}
              onChange={(e) => handleUpdateNewDataFile("content", e.target.value)}
              autosize
              minRows={10}
              className={styles.mono}
              placeholder="Enter file content…"
            />
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={handleCloseModal} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              leftSection={<Icon name="check" size={14} />}
              onClick={handleCreateDataFile}
              loading={isCreating}
              disabled={!newDataFile.filename.trim() || isCreating}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        title="Edit data file"
        opened={isEditModalOpen}
        onClose={handleCloseEditModal}
        size="lg"
        closeOnEscape={!isUpdating}
        closeOnClickOutside={!isUpdating}
        withCloseButton={!isUpdating}
        centered
      >
        {isFetchingEditData ? (
          <Center p="lg">
            <Group gap="sm">
              <Loader size="sm" />
              <span>Loading data file…</span>
            </Group>
          </Center>
        ) : (
          <Stack gap="md">
            <Group gap="sm">
              <FileButton
                resetRef={resetEditUpload}
                accept={UPLOAD_ACCEPT}
                onChange={handleEditFileUpload}
              >
                {(props) => (
                  <Button
                    {...props}
                    variant="outline"
                    leftSection={<Icon name="download" size={14} />}
                  >
                    Replace content
                  </Button>
                )}
              </FileButton>
              <Text size="sm" c="dimmed">
                Upload a new file to replace current content
              </Text>
            </Group>

            <TextInput
              id="edit-filename"
              label="Filename"
              value={editDataFile.filename}
              description="The filename can't be changed after creation"
              disabled
            />

            {editDataFile.isImage ? (
              <div>
                <Text size="sm" fw={500} mb={6}>
                  Image preview
                </Text>
                {editDataFile.content ? (
                  <img
                    src={imageSource(editDataFile.content)}
                    alt={editDataFile.filename}
                    className={styles.imagePreview}
                  />
                ) : (
                  <Text c="dimmed">No image loaded</Text>
                )}
              </div>
            ) : (
              <Textarea
                id="edit-content"
                label="File content"
                value={editDataFile.content}
                onChange={(e) => setEditDataFile((prev) => ({ ...prev, content: e.target.value }))}
                autosize
                minRows={10}
                className={styles.mono}
                placeholder="Enter file content…"
              />
            )}

            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={handleCloseEditModal} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                leftSection={<Icon name="check" size={14} />}
                onClick={handleSaveEditDataFile}
                loading={isUpdating}
                disabled={!editDataFile.filename.trim() || isUpdating || isFetchingEditData}
              >
                Save
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
};
