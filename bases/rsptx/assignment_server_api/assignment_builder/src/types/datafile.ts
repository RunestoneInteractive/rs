// Types for DataFile management in ActiveCode exercises

export interface DataFile {
  id?: string;
  filename: string;
  content: string;
  isImage: boolean;
  rows?: number;
  cols?: number;
  isEditable?: boolean;
  isNew?: boolean;
}

export interface ExistingDataFile {
  id: number;
  acid: string;
  filename: string;
  course_id: string;
  owner: string | null;
  main_code: string;
}

export type SelectedDataFile = string;

export interface CreateDataFilePayload {
  filename: string;
  main_code: string;
}

export interface CreateDataFileResponse {
  status: string;
  acid: string;
}

export interface UpdateDataFilePayload {
  acid: string;
  main_code: string;
}

export interface UpdateDataFileResponse {
  status: string;
}

export interface DeleteDataFileResponse {
  status: string;
}

export interface GetDataFileResponse {
  id: number;
  acid: string;
  filename: string;
  course_id: string;
  owner: string | null;
  main_code: string;
  is_owner: boolean;
}

export interface FetchDataFilesResponse {
  datafiles: ExistingDataFile[];
}
