import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";

import ProtectedRoute from "./common/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";
import MainLayout from "./layouts/MainLayout";

const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const ContractorViewPage = lazy(() => import("./pages/ContractorViewPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PlansListPage = lazy(() => import("./pages/PlansListPage"));
const PlanNewPage = lazy(() => import("./pages/PlanNewPage"));
const PlanWizard = lazy(() => import("./pages/PlanWizard"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UpgradePage = lazy(() => import("./pages/UpgradePage"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const ArchitectHome = lazy(() => import("./pages/architect/ArchitectHome"));
const NotFound = lazy(() => import("./pages/NotFound"));

const titles = {
  home: "VastuVerse - AI house planning for Indian homes",
  login: "Log in - VastuVerse",
  onboarding: "Welcome - VastuVerse",
  dashboard: "Dashboard - VastuVerse",
  plans: "My plans - VastuVerse",
  plansNew: "New plan - VastuVerse",
  wizard: "Plan wizard - VastuVerse",
  marketplace: "Marketplace - VastuVerse",
  profile: "Profile - VastuVerse",
  admin: "Admin - VastuVerse",
  architect: "Architect workspace - VastuVerse",
  contractor: "Contractor view - VastuVerse",
  notFound: "Not found - VastuVerse",
};

function PageTitle({ title }) {
  return (
    <Helmet>
      <title>{title}</title>
    </Helmet>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <Helmet>
          <html lang="en" />
          <meta name="theme-color" content="#2E7D32" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, viewport-fit=cover"
          />
          <link rel="manifest" href="/manifest.json" />
        </Helmet>

        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <Helmet>
                    <title>{titles.home}</title>
                    <meta
                      name="description"
                      content="Design your home, room by room, with AI-assisted floor plans, interiors, cost estimates, and architect reviews built for India."
                    />
                  </Helmet>
                  <HomePage />
                </>
              }
            />
            <Route
              path="/login"
              element={
                <>
                  <PageTitle title={titles.login} />
                  <LoginPage />
                </>
              }
            />
            <Route
              path="/onboarding"
              element={
                <>
                  <PageTitle title={titles.onboarding} />
                  <OnboardingPage />
                </>
              }
            />
            <Route
              path="/contractor/:token"
              element={
                <>
                  <PageTitle title={titles.contractor} />
                  <ContractorViewPage />
                </>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <>
                    <PageTitle title={titles.dashboard} />
                    <Dashboard />
                  </>
                }
              />
              <Route
                path="/plans"
                element={
                  <>
                    <PageTitle title={titles.plans} />
                    <PlansListPage />
                  </>
                }
              />
              <Route
                path="/plans/new"
                element={
                  <>
                    <PageTitle title={titles.plansNew} />
                    <PlanNewPage />
                  </>
                }
              />
              <Route
                path="/plans/:planId/step/:stepNumber"
                element={
                  <>
                    <PageTitle title={titles.wizard} />
                    <PlanWizard />
                  </>
                }
              />
              <Route
                path="/marketplace"
                element={
                  <>
                    <PageTitle title={titles.marketplace} />
                    <MarketplacePage />
                  </>
                }
              />
              <Route
                path="/profile"
                element={
                  <>
                    <PageTitle title={titles.profile} />
                    <ProfilePage />
                  </>
                }
              />
              <Route
                path="/upgrade"
                element={
                  <>
                    <PageTitle title="Upgrade plan - VastuVerse" />
                    <UpgradePage />
                  </>
                }
              />
            </Route>

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requireRole={["admin"]}>
                  <>
                    <PageTitle title={titles.admin} />
                    <AdminHome />
                  </>
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute requireRole={["architect"]}>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/architect/*"
                element={
                  <>
                    <PageTitle title={titles.architect} />
                    <ArchitectHome />
                  </>
                }
              />
            </Route>

            <Route
              path="*"
              element={
                <>
                  <PageTitle title={titles.notFound} />
                  <NotFound />
                </>
              }
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HelmetProvider>
  );
}
