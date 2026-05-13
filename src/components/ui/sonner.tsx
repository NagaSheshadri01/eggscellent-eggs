import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      duration={1800}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-full !px-5 !py-3 !bg-brown !text-primary !border-0 !shadow-yolk !font-display !font-semibold !text-sm",
          description: "!text-primary/80 !font-body !font-normal",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-brown",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "!bg-brown !text-primary",
          error: "!bg-destructive !text-destructive-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
