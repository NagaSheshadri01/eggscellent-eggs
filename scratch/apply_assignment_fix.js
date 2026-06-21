import fs from 'fs';

let content = fs.readFileSync('src/pages/admin/AdminLogistics.tsx', 'utf-8');

// 1. Rename State Variable
content = content.replace(
  /const \[selectedLedgerIds, setSelectedLedgerIds\] = useState<string\[\]>\(\[\]\);/,
  'const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);'
);

// 2. Replace bulkAssignMutation
content = content.replace(
  /const bulkAssignMutation = useMutation\(\{\s*mutationFn: async \(\{ ledgerIds, partnerId \}: \{ ledgerIds: string\[\]; partnerId: string \}\) => \{[\s\S]*?toast\.error\("Bulk assignment failed: " \+ err\.message\);\s*\}\s*\}\);/m,
  `const bulkAssignMutation = useMutation({
    mutationFn: async ({ stopIds, partnerId }: { stopIds: string[]; partnerId: string }) => {
      const selectedDriverId = partnerId === "unassigned" ? null : partnerId;
      const { data, error } = await (supabase as any)
        .from('orders')
        .update({ delivery_partner_id: selectedDriverId })
        .in('id', stopIds)
        .select('id');

      if (error) throw error;
      if (data && data.length === 0) throw new Error("Assignment failed: No rows updated (Permission denied?)");
      return { stopIds, partnerId };
    },
    onSuccess: (data) => {
      toast.success(\`Assigned \${data.stopIds.length} stops successfully!\`);
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-manifest-today"] });
      queryClient.invalidateQueries({ queryKey: ["tomorrow-dispatch-manifest"] });
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-manifest"] });
      setSelectedStopIds([]); // Reset selection
      setTargetPartnerId(""); // Reset partner selection
    },
    onError: (err: any) => {
      toast.error("Bulk assignment failed: " + err.message);
    }
  });`
);

// 3. Replace all remaining setSelectedLedgerIds([]) with setSelectedStopIds([])
content = content.replace(/setSelectedLedgerIds/g, 'setSelectedStopIds');

// 4. Replace handleToggleRow and handleToggleCluster
content = content.replace(
  /const handleToggleRow = \(stop: DeliveryStop\) => \{[\s\S]*?const handleToggleCluster = \(clusterStops: DeliveryStop\[\]\) => \{[\s\S]*?\}\s*\};\s*return \(/m,
  `const handleToggleRow = (stop: DeliveryStop) => {
    const isSelected = selectedStopIds.includes(stop.id);
    
    if (isSelected) {
      setSelectedStopIds(prev => prev.filter(id => id !== stop.id));
    } else {
      setSelectedStopIds(prev => [...prev, stop.id]);
    }
  };

  const handleToggleCluster = (clusterStops: DeliveryStop[]) => {
    const clusterStopIds = clusterStops.map(s => s.id);
    const allSelected = clusterStopIds.every(id => selectedStopIds.includes(id));

    if (allSelected) {
      setSelectedStopIds(prev => prev.filter(id => !clusterStopIds.includes(id)));
    } else {
      setSelectedStopIds(prev => {
        const unique = new Set([...prev, ...clusterStopIds]);
        return Array.from(unique);
      });
    }
  };

  return (`
);

// 5. Update clusterIds mapping
content = content.replace(
  /const clusterIds = clusterStops\.flatMap\(\(s: DeliveryStop\) => s\.items\.map\(\(i: any\) => i\.ledgerId\)\);/m,
  'const clusterIds = clusterStops.map((s: DeliveryStop) => s.id);'
);

// 6. Update isAllClusterSelected / isSomeClusterSelected / isAllSelected
content = content.replace(/selectedLedgerIds/g, 'selectedStopIds');

// Update stop selection logic inside the map
content = content.replace(
  /const isAllSelected = stop\.items\.every\(item => selectedStopIds\.includes\(item\.ledgerId\)\);/g,
  'const isAllSelected = selectedStopIds.includes(stop.id);'
);

// 7. Update mutation parameters
content = content.replace(
  /bulkAssignMutation\.mutate\(\{\s*ledgerIds: selectedStopIds,\s*partnerId: targetPartnerId\s*\}\);/m,
  `bulkAssignMutation.mutate({
                    stopIds: selectedStopIds,
                    partnerId: targetPartnerId
                  });`
);

fs.writeFileSync('src/pages/admin/AdminLogistics.tsx', content);
console.log("Successfully updated assignment logic.");
