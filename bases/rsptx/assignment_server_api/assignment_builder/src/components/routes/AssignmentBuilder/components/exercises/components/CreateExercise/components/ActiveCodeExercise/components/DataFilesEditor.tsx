import { Button } from "primereact/button";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import { FileUpload, FileUploadHandlerEvent } from "primereact/fileupload";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { FC, useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  useCreateDatafileMutation,
  useDeleteDatafileMutation,
  useFetchDatafileQuery,
  useFetchDatafilesQuery,
  useUpdateDatafileMutation
} from "@/store/datafile/datafile.logic.api";
import { DataFile, ExistingDataFile, SelectedDataFile } from "@/types/datafile";

import styles from "../../../shared/styles/CreateExercise.module.css";

// Supported file extensions for datafiles
const SUPPORTED_EXTENSIONS = [
  // Text files
  ".txt",
  ".csv",
  // Code files
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
  // Image files
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg"
];

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

// Initial state for new datafile in modal
const initialNewDataFile: DataFile = {
  filename: "",
  content: "",
  isImage: false,
  rows: 10,
  cols: 60,
  isEditable: true
};

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
  const fileUploadRef = useRef<FileUpload>(null);
  const editFileUploadRef = useRef<FileUpload>(null);

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
    if (fileUploadRef.current) {
      fileUploadRef.current.clear();
    }
  };

  const handleUpdateNewDataFile = (field: keyof DataFile, value: any) => {
    setNewDataFile((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = useCallback((event: FileUploadHandlerEvent) => {
    const file = event.files[0];
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

    if (fileUploadRef.current) {
      fileUploadRef.current.clear();
    }
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
    if (editFileUploadRef.current) {
      editFileUploadRef.current.clear();
    }
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
    (event: FileUploadHandlerEvent) => {
      const file = event.files[0];
      if (!file) return;

      const originalExtension = getFileExtension(editDataFile.filename);
      const uploadedExtension = getFileExtension(file.name);

      if (originalExtension !== uploadedExtension) {
        toast.error(
          `File extension mismatch. Expected "${originalExtension}" but got "${uploadedExtension}". Please upload a file with the same extension.`,
          { duration: 5000 }
        );
        if (editFileUploadRef.current) {
          editFileUploadRef.current.clear();
        }
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

      if (editFileUploadRef.current) {
        editFileUploadRef.current.clear();
      }
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
    confirmDialog({
      message: `Are you sure you want to delete "${filename}"? This action cannot be undone.`,
      header: "Delete Data File",
      icon: "pi pi-exclamation-triangle",
      acceptClassName: "p-button-danger",
      accept: async () => {
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

  const modalFooter = (
    <div className="flex justify-content-end gap-2">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={handleCloseModal}
        disabled={isCreating}
      />
      <Button
        label="Create"
        icon="pi pi-check"
        onClick={handleCreateDataFile}
        loading={isCreating}
        disabled={!newDataFile.filename.trim() || isCreating}
      />
    </div>
  );

  return (
    <div className={styles.dataFilesEditor}>
      <div className="flex gap-2 align-items-start">
        <div className="flex-grow-1">
          {isLoading ? (
            <div className="flex align-items-center gap-2 p-3">
              <i className="pi pi-spin pi-spinner"></i>
              <span>Loading data files...</span>
            </div>
          ) : (
            <MultiSelect
              id="data-files"
              value={selectedDataFiles}
              options={existingDatafilesOptions}
              onChange={(e) => {
                onSelectedDataFilesChange(e.value);
              }}
              placeholder="Select data files to include"
              className="w-full"
              display="chip"
              filter
              showSelectAll
              maxSelectedLabels={5}
              emptyMessage="No data files available"
              emptyFilterMessage="No matching data files"
            />
          )}
        </div>
        <Button
          label="Add New"
          icon="pi pi-plus"
          className="p-button-outlined flex-shrink-0"
          onClick={handleOpenModal}
        />
      </div>

      {selectedDataFiles.length > 0 && (
        <div className="mt-3 p-3 surface-100 border-round">
          <h5 className="m-0 mb-2">Selected Files ({selectedDataFiles.length})</h5>
          <div className="flex flex-column gap-2">
            {selectedDataFiles.map((selectedFileAcid) => {
              const file = existingDatafiles.find((df) => df.acid === selectedFileAcid);
              const isOwner = file?.owner !== null; // If owner is set and matches current user
              return (
                <div
                  key={selectedFileAcid}
                  className="flex align-items-center justify-content-between p-2 surface-0 border-round border-1 surface-border"
                >
                  <div className="flex align-items-center gap-2">
                    <span className="font-medium">{file?.filename || selectedFileAcid}</span>
                    {file?.owner && <span className="text-xs text-gray-500">by {file.owner}</span>}
                  </div>
                  <div className="flex align-items-center gap-2">
                    {isOwner && (
                      <>
                        <Button
                          icon="pi pi-pencil"
                          className="p-button-text p-button-sm p-button-rounded"
                          tooltip="Edit datafile"
                          tooltipOptions={{ position: "top" }}
                          onClick={() => handleOpenEditModal(selectedFileAcid)}
                          disabled={isUpdating || isDeleting}
                        />
                        <Button
                          icon="pi pi-trash"
                          className="p-button-text p-button-sm p-button-rounded p-button-danger"
                          tooltip="Delete datafile"
                          tooltipOptions={{ position: "top" }}
                          onClick={() =>
                            handleDeleteDatafile(
                              selectedFileAcid,
                              file?.filename || selectedFileAcid
                            )
                          }
                          disabled={isUpdating || isDeleting}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create New Data File Modal */}
      <Dialog
        header="Create New Data File"
        visible={isModalOpen}
        onHide={handleCloseModal}
        style={{ width: "50vw", minWidth: "400px" }}
        footer={modalFooter}
        closable={!isCreating}
        closeOnEscape={!isCreating}
        dismissableMask={!isCreating}
        modal
      >
        <div className="flex flex-column gap-4">
          <div className="flex gap-2 mb-2">
            <FileUpload
              ref={fileUploadRef}
              mode="basic"
              name="datafile"
              accept="text/*,image/*,.txt,.csv,.json,.py,.js,.html,.css"
              maxFileSize={5000000}
              customUpload
              auto
              uploadHandler={handleFileUpload}
              chooseLabel="Upload File"
              className="p-button-outlined"
            />
            <small className="text-gray-500 flex align-items-center">
              Or fill in the form manually below
            </small>
          </div>

          <div>
            <label htmlFor="new-filename" className="block mb-2 font-medium">
              Filename *
            </label>
            <InputText
              id="new-filename"
              value={newDataFile.filename}
              onChange={(e) => {
                handleUpdateNewDataFile("filename", e.target.value);
                if (filenameError) setFilenameError("");
              }}
              placeholder="e.g., data.txt or image.png"
              className={`w-full ${filenameError ? "p-invalid" : ""}`}
            />
            {filenameError && <small className="p-error block mt-1">{filenameError}</small>}
          </div>

          {newDataFile.isImage ? (
            <div>
              <label className="block mb-2 font-medium">Image Preview</label>
              {newDataFile.content ? (
                <img
                  src={newDataFile.content}
                  alt={newDataFile.filename}
                  style={{ maxWidth: "300px", maxHeight: "200px", objectFit: "contain" }}
                  className="border-1 border-round surface-border"
                />
              ) : (
                <div className="text-gray-500">No image loaded</div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="new-content" className="block mb-2 font-medium">
                  File Content
                </label>
                <InputTextarea
                  id="new-content"
                  value={newDataFile.content}
                  onChange={(e) => handleUpdateNewDataFile("content", e.target.value)}
                  rows={10}
                  className="w-full font-mono"
                  placeholder="Enter file content here..."
                  style={{ resize: "vertical" }}
                />
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Edit Data File Modal */}
      <Dialog
        header="Edit Data File"
        visible={isEditModalOpen}
        onHide={handleCloseEditModal}
        style={{ width: "50vw", minWidth: "400px" }}
        footer={
          <div className="flex justify-content-end gap-2">
            <Button
              label="Cancel"
              icon="pi pi-times"
              className="p-button-text"
              onClick={handleCloseEditModal}
              disabled={isUpdating}
            />
            <Button
              label="Save"
              icon="pi pi-check"
              onClick={handleSaveEditDataFile}
              loading={isUpdating}
              disabled={!editDataFile.filename.trim() || isUpdating || isFetchingEditData}
            />
          </div>
        }
        closable={!isUpdating}
        closeOnEscape={!isUpdating}
        dismissableMask={!isUpdating}
        modal
      >
        {isFetchingEditData ? (
          <div className="flex align-items-center justify-content-center p-4">
            <i className="pi pi-spin pi-spinner mr-2"></i>
            <span>Loading datafile...</span>
          </div>
        ) : (
          <div className="flex flex-column gap-4">
            <div className="flex gap-2 mb-2">
              <FileUpload
                ref={editFileUploadRef}
                mode="basic"
                name="datafile"
                accept="text/*,image/*,.txt,.csv,.json,.py,.js,.html,.css"
                maxFileSize={5000000}
                customUpload
                auto
                uploadHandler={handleEditFileUpload}
                chooseLabel="Replace Content"
                className="p-button-outlined"
              />
              <small className="text-gray-500 flex align-items-center">
                Upload a new file to replace current content
              </small>
            </div>

            <div>
              <label htmlFor="edit-filename" className="block mb-2 font-medium">
                Filename
              </label>
              <InputText
                id="edit-filename"
                value={editDataFile.filename}
                className="w-full"
                disabled
              />
              <small className="text-gray-500 block mt-1">
                Filename cannot be changed after creation
              </small>
            </div>

            {editDataFile.isImage ? (
              <div>
                <label className="block mb-2 font-medium">Image Preview</label>
                {editDataFile.content ? (
                  <img
                    src={
                      editDataFile.content.startsWith("data:")
                        ? editDataFile.content
                        : `data:image/png;base64,${editDataFile.content}`
                    }
                    alt={editDataFile.filename}
                    style={{ maxWidth: "300px", maxHeight: "200px", objectFit: "contain" }}
                    className="border-1 border-round surface-border"
                  />
                ) : (
                  <div className="text-gray-500">No image loaded</div>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="edit-content" className="block mb-2 font-medium">
                  File Content
                </label>
                <InputTextarea
                  id="edit-content"
                  value={editDataFile.content}
                  onChange={(e) =>
                    setEditDataFile((prev) => ({ ...prev, content: e.target.value }))
                  }
                  rows={10}
                  className="w-full font-mono"
                  placeholder="Enter file content here..."
                  style={{ resize: "vertical" }}
                />
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Confirm Dialog for delete */}
      <ConfirmDialog />
    </div>
  );
};
