export function PageNotice({
  error,
  notice,
  loadError,
  loadErrorMessage,
}: {
  error: string;
  notice: string;
  loadError: boolean;
  loadErrorMessage: string;
}) {
  if (!error && !notice && !loadError) return null;
  const isError = Boolean(error || loadError);

  return (
    <div className={isError ? "notice error page-notice" : "notice success page-notice"} role={isError ? "alert" : "status"}>
      {error || (loadError ? loadErrorMessage : notice)}
    </div>
  );
}
