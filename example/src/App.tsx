import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

function AuthzDemo() {
  const [userId] = useState("demo_user_123");
  const [targetUserId, setTargetUserId] = useState("new_user_456");

  // Query user roles
  const userRoles = useQuery(api.example.getUserRoles, {
    targetUserId: userId,
  });

  // Mutations
  const assignRole = useMutation(api.example.assignEditorRole);

  const handleAssignRole = async () => {
    try {
      await assignRole({ targetUserId });
      alert(`Assigned editor role to ${targetUserId}`);
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  return (
    <div
      style={{
        padding: "1.5rem",
        border: "1px solid rgba(128, 128, 128, 0.3)",
        borderRadius: "8px",
        marginBottom: "1rem",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Authorization Demo</h2>

      <div style={{ marginBottom: "1.5rem" }}>
        <h3>Current User: {userId}</h3>
        <h4>Roles:</h4>
        {userRoles === undefined ? (
          <p>Loading...</p>
        ) : userRoles.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No roles assigned</p>
        ) : (
          <ul>
            {userRoles.map((role) => (
              <li key={role._id}>
                <strong>{role.role}</strong>
                {role.scope && (
                  <span style={{ color: "#666" }}>
                    {" "}
                    (scoped to {role.scope.type}:{role.scope.id})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        style={{
          padding: "1rem",
          backgroundColor: "rgba(128, 128, 128, 0.1)",
          borderRadius: "8px",
        }}
      >
        <h4>Assign Editor Role</h4>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="text"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="User ID"
            style={{ padding: "0.5rem", flex: 1 }}
          />
          <button onClick={handleAssignRole}>Assign Editor</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <h1>@dbjpanda/convex-authz Demo</h1>
      <div className="card">
        <AuthzDemo />
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          See <code>example/convex/example.ts</code> for usage examples
        </p>
      </div>
    </>
  );
}

export default App;
