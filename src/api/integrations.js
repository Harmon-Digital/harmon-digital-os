// Supabase integrations (file uploads, email, etc.)
import { supabase } from './supabaseClient';

// File upload to Supabase Storage
export const UploadFile = async ({ file }) => {
  const fileName = `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, file);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(fileName);

  return { file_url: urlData.publicUrl };
};

// Private file upload
export const UploadPrivateFile = async ({ file }) => {
  const fileName = `private/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, file);

  if (error) throw error;
  return { file_path: data.path };
};

// Create signed URL for private files
export const CreateFileSignedUrl = async ({ filePath, expiresIn = 3600 }) => {
  const { data, error } = await supabase.storage
    .from('uploads')
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return { signed_url: data.signedUrl };
};

// Email sending - requires Edge Function
export const SendEmail = async (params) => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: params
  });
  if (error) throw error;
  return data;
};

// LLM invocation - requires Edge Function
export const InvokeLLM = async (params) => {
  const { data, error } = await supabase.functions.invoke('invoke-llm', {
    body: params
  });
  if (error) throw error;
  return data;
};

// Image generation - requires Edge Function
export const GenerateImage = async (params) => {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: params
  });
  if (error) throw error;
  return data;
};

// Extract data from uploaded file - requires Edge Function
export const ExtractDataFromUploadedFile = async (params) => {
  const { data, error } = await supabase.functions.invoke('extract-file-data', {
    body: params
  });
  if (error) throw error;
  return data;
};

// Core object for backward compatibility
export const Core = {
  UploadFile,
  UploadPrivateFile,
  CreateFileSignedUrl,
  SendEmail,
  InvokeLLM,
  GenerateImage,
  ExtractDataFromUploadedFile
};






