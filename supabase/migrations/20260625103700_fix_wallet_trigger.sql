CREATE OR REPLACE FUNCTION public.check_wallet_low_balance_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_sub_record RECORD;
  v_item_record RECORD;
  v_next_price NUMERIC(10,2);
BEGIN
  -- Check user's active subscriptions to evaluate the next delivery cost
  FOR v_sub_record IN 
    SELECT id
    FROM public.subscriptions
    WHERE user_id = NEW.user_id AND status = 'active'
  LOOP
    FOR v_item_record IN
      SELECT si.product_slug, si.quantity, p.discounted_price, p.name
      FROM public.subscription_items si
      JOIN public.products p ON p.slug = si.product_slug
      WHERE si.subscription_id = v_sub_record.id
    LOOP
      v_next_price := v_item_record.discounted_price * v_item_record.quantity;
      
      -- If balance is less than next delivery cost, issue a high-visibility warning notification
      IF NEW.balance < v_next_price THEN
        INSERT INTO public.user_notifications (user_id, title, message, notification_type, metadata)
        VALUES (
          NEW.user_id,
          'Prepaid Balance Low Warning',
          'Your wallet balance (' || NEW.balance || ') is lower than the next delivery cost (' || v_next_price || ') for ' || v_item_record.name || '. Please recharge to avoid interruptions.',
          'alert',
          jsonb_build_object('subscription_id', v_sub_record.id, 'shortfall', v_next_price - NEW.balance)
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
