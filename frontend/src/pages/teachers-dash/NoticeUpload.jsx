import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

import TeacherHeader from "../../components/teacher/TeacherHeader";
import { getTeacherProfile } from "../../services/teacherService";
import { logout } from "../../services/authService";
import {
  uploadNotice,
  uploadTextNotice,
  uploadNoticesBatch,
} from "../../api/notifications";

import "./NoticeUpload.css";

export default function NoticeUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [activeMode, setActiveMode] = useState("file");

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [noticeText, setNoticeText] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getTeacherProfile()
      .then(setProfile)
      .catch((error) => {
        console.error("Failed to load teacher profile:", error);
      });
  }, []);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const invalidFile = files.find((file) => !allowedTypes.includes(file.type));

    if (invalidFile) {
      setStatus("error");
      setMessage(
        `${invalidFile.name} is not a supported file. Use PDF, JPG, PNG or WEBP.`,
      );
      return;
    }

    if (activeMode === "batch") {
      if (files.length > 20) {
        setStatus("error");
        setMessage("You can upload a maximum of 20 notices at once.");
        return;
      }

      setSelectedFiles(files);
      setSelectedFile(null);
    } else {
      setSelectedFile(files[0]);
      setSelectedFiles([]);
    }

    setStatus("idle");
    setMessage("");
  };

  const handleSubmit = async () => {
    setStatus("loading");
    setMessage("");

    try {
      if (activeMode === "file") {
        if (!selectedFile) {
          throw new Error("Please select a notice file first.");
        }

        await uploadNotice(selectedFile);

        setSelectedFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        setStatus("success");
        setMessage(
          "Notice accepted. AI processing and student routing have started.",
        );
      } else if (activeMode === "batch") {
        if (!selectedFiles.length) {
          throw new Error("Please select at least one notice file.");
        }

        const result = await uploadNoticesBatch(selectedFiles);

        setSelectedFiles([]);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        if (result.failed === 0) {
          setStatus("success");

          setMessage(
            `${result.accepted} notice${
              result.accepted === 1 ? "" : "s"
            } accepted for processing.`,
          );
        } else if (result.accepted > 0) {
          setStatus("partial");

          setMessage(
            `${result.accepted} notice${
              result.accepted === 1 ? "" : "s"
            } accepted and ${result.failed} failed.`,
          );
        } else {
          setStatus("error");

          setMessage(`All ${result.failed} selected notices failed to upload.`);
        }

        setMessage(
          `${result.accepted} notice${
            result.accepted === 1 ? "" : "s"
          } accepted for processing${
            result.failed > 0 ? `, ${result.failed} failed.` : "."
          }`,
        );
      } else {
        if (!noticeText.trim()) {
          throw new Error("Please enter the notice text.");
        }

        await uploadTextNotice(noticeText);

        setNoticeText("");

        setStatus("success");

        setMessage(
          "Notice accepted. AI processing and student routing have started.",
        );
      }
    } catch (error) {
      console.error("Notice upload failed:", error);

      setStatus("error");
      setMessage(error.message || "Notice processing failed.");
    }
  };

  return (
    <div className="notice-upload-page">
      <div className="teacher-shell-inner">
        <TeacherHeader profile={profile} />

        <button
          type="button"
          className="notice-back-btn"
          onClick={() => navigate("/teacher/dashboard")}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <section className="notice-upload-hero">
          <span className="notice-upload-eyebrow">
            NOTICE & INTERVENTION SYSTEM
          </span>

          <h1>Publish a College Notice</h1>

          <p>
            Upload or paste a notice. E.A.R.N will extract the important
            details, determine eligibility, match relevant students and generate
            personalized notifications.
          </p>
        </section>

        <section className="notice-upload-panel">
          <div className="notice-mode-switch">
            <button
              type="button"
              className={activeMode === "file" ? "active" : ""}
              onClick={() => {
                setActiveMode("file");
                setSelectedFiles([]);
                setStatus("idle");
                setMessage("");

                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              <Upload size={17} />
              Upload File
            </button>

            <button
              type="button"
              className={activeMode === "batch" ? "active" : ""}
              onClick={() => {
                setActiveMode("batch");
                setSelectedFile(null);
                setStatus("idle");
                setMessage("");

                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              <Upload size={17} />
              Batch Upload
            </button>

            <button
              type="button"
              className={activeMode === "text" ? "active" : ""}
              onClick={() => {
                setActiveMode("text");
                setSelectedFile(null);
                setSelectedFiles([]);
                setStatus("idle");
                setMessage("");

                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              <FileText size={17} />
              Paste Text
            </button>
          </div>

          {activeMode === "file" ? (
            <div className="notice-file-section">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                hidden
              />

              <button
                type="button"
                className="notice-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <>
                    {selectedFile.type === "application/pdf" ? (
                      <FileText size={42} />
                    ) : (
                      <ImageIcon size={42} />
                    )}

                    <strong>{selectedFile.name}</strong>

                    <span>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>

                    <small>Click to replace file</small>
                  </>
                ) : (
                  <>
                    <Upload size={42} />

                    <strong>Choose a notice file</strong>

                    <span>PDF, JPG, PNG or WEBP</span>

                    <small>The file will be processed automatically</small>
                  </>
                )}
              </button>
            </div>
          ) : activeMode === "batch" ? (
            <div className="notice-file-section">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                onChange={handleFileChange}
                hidden
              />

              <button
                type="button"
                className="notice-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={42} />

                <strong>
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} notices selected`
                    : "Choose multiple notice files"}
                </strong>

                <span>PDF, JPG, PNG or WEBP</span>

                <small>Maximum 20 notices at once</small>
              </button>

              {selectedFiles.length > 0 && (
                <div className="notice-batch-files">
                  {selectedFiles.map((file, index) => (
                    <div
                      className="notice-batch-file"
                      key={`${file.name}-${index}`}
                    >
                      {file.type === "application/pdf" ? (
                        <FileText size={17} />
                      ) : (
                        <ImageIcon size={17} />
                      )}

                      <div>
                        <strong>{file.name}</strong>

                        <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFiles((currentFiles) =>
                            currentFiles.filter((_, i) => i !== index),
                          );
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="notice-text-section">
              <textarea
                value={noticeText}
                onChange={(event) => setNoticeText(event.target.value)}
                placeholder="Paste the complete college notice here..."
                rows={14}
              />

              <div className="notice-text-count">
                {noticeText.length} characters
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="notice-status loading">
              <div className="notice-spinner" />
              Processing notice...
            </div>
          )}

          {status === "success" && (
            <div className="notice-status success">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          {status === "partial" && (
            <div className="notice-status partial">
              <AlertCircle size={18} />
              {message}
            </div>
          )}

          {status === "error" && (
            <div className="notice-status error">
              <AlertCircle size={18} />
              {message}
            </div>
          )}

          <button
            type="button"
            className="notice-submit-btn"
            onClick={handleSubmit}
            disabled={status === "loading"}
          >
            <Send size={17} />
            {status === "loading" ? "Processing..." : "Process Notice"}
          </button>
        </section>

        <section className="notice-pipeline">
          <div>
            <span>01</span>
            <strong>Extract</strong>
            <p>OCR / PDF text extraction</p>
          </div>

          <div>
            <span>02</span>
            <strong>Understand</strong>
            <p>AI notice structuring</p>
          </div>

          <div>
            <span>03</span>
            <strong>Match</strong>
            <p>Eligibility + semantic relevance</p>
          </div>

          <div>
            <span>04</span>
            <strong>Notify</strong>
            <p>Personalized student feed</p>
          </div>
        </section>

        <button
          type="button"
          className="notice-logout"
          onClick={async () => {
            await logout();
            navigate("/", { replace: true });
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
