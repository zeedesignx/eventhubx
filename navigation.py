import sys
import os

def route_action(action, **kwargs):
    """
    Layer 2: Navigation (Reasoning & Routing)
    This function acts as the decision layer. It does not perform business logic.
    Instead, it routes the validated data to atomic tools in Layer 3.
    """
    print(f"Routing action: {action} with args: {kwargs}")
    
    tools_dir = os.path.join(os.path.dirname(__file__), 'tools')
    
    if action == 'get_events':
        print(f"-> Dispatching to tools/get_events.py")
        import tools.get_events as get_evt_list
        return get_evt_list.get_events()
        
    elif action == 'get_event':
        print(f"-> Dispatching to tools/get_event.py (Target: {kwargs.get('eventId')})")
        pass
        
    elif action == 'upsert_person':
        print(f"-> Dispatching to tools/upsert_person.py (Target: {kwargs.get('email')})")
        pass
        
    elif action == 'upsert_exhibitor':
        print(f"-> Dispatching to tools/upsert_exhibitor.py (Target: {kwargs.get('name')})")
        pass
        
    elif action == 'get_communities':
        print(f"-> Dispatching to tools/get_events.py (get_raw_events)")
        import tools.get_events as get_evt_list
        return get_evt_list.get_raw_events()
        
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)

if __name__ == '__main__':
    print("EventHubX Navigation Layer Initialized.")
