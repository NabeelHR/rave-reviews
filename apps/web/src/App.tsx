import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ArtistPage } from "./pages/ArtistPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { EventPage } from "./pages/EventPage";
import { MePage } from "./pages/MePage";
import { SetPage } from "./pages/SetPage";
import { UserPage } from "./pages/UserPage";
import { VenuePage } from "./pages/VenuePage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DiscoveryPage />} />
        <Route path="events/:id" element={<EventPage />} />
        <Route path="venues/:id" element={<VenuePage />} />
        <Route path="artists/:id" element={<ArtistPage />} />
        <Route path="sets/:id" element={<SetPage />} />
        <Route path="me" element={<MePage />} />
        <Route path="users/:id" element={<UserPage />} />
      </Route>
    </Routes>
  );
}
