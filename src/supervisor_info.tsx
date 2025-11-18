type SupervisingPhysicianCardProps = {
  name?: string;
  roleLabel?: string;
  phone?: string;
  imageUrl?: string;
  online?: boolean;
};

export function SupervisingPhysicianCard({
  name = "Supervising Physician",
  roleLabel,
  phone,
  imageUrl,
  online = true,
}: SupervisingPhysicianCardProps) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "28rem", // max-w-md
        margin: "0 auto",
        borderRadius: "1rem", // rounded-2xl
        border: "1px solid #e2e8f0", // slate-200
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)", // shadow-sm
        padding: "1.5rem", // p-6
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: "0.875rem", // text-sm
          fontWeight: 500,
          color: "#6b7280", // slate-500
          marginBottom: "1rem",
        }}
      >
        Supervising Physician
      </span>

      {/* Avatar Container */}
      <div
        style={{
          position: "relative",
          width: "6rem", // h-24 w-24
          height: "6rem",
        }}
      >
        <img
          src={imageUrl}
          alt={name}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "9999px",
            objectFit: "cover",
            boxShadow: "0 4px 6px rgba(0,0,0,0.15)",
          }}
        />

        {/* Status Dot */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "1rem",
            height: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: "1rem",
              height: "1rem",
              borderRadius: "9999px",
              border: "2px solid white",
              backgroundColor: online ? "#22c55e" : "#9ca3af",
              position: "relative",
              right: "0.5rem",
            }}
          >
            {online && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "9999px",
                  backgroundColor: "rgba(34, 197, 94, 0.45)",
                  animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
            )}
          </span>
        </div>
      </div>

      {/* Name */}
      <h3
        style={{
          marginTop: "1rem",
          fontSize: "1.125rem", // text-lg
          fontWeight: 600,
          color: "#111827", // slate-900
        }}
      >
        {name}
      </h3>

      {/* Role */}
      {roleLabel && (
        <p
          style={{
            marginTop: "0.25rem",
            fontSize: "0.875rem",
            color: "#6b7280", // slate-500
          }}
        >
          {roleLabel}
        </p>
      )}

      {/* Phone */}
      {phone && (
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#4b5563", // slate-600
          }}
        >
          {phone}
        </p>
      )}
    </div>
  );
}
